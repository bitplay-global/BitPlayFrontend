import { KEYS } from "./storage";
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 300_000;
export class EventQueue {
    options;
    events = [];
    loaded = false;
    flushing = false;
    /** Consecutive failures, for backoff. Reset by any success. */
    failures = 0;
    nextAttemptAt = 0;
    stats = { queued: 0, sent: 0, dropped: 0, rejected: 0, flushes: 0 };
    constructor(options) {
        this.options = options;
    }
    async load() {
        if (this.loaded)
            return;
        this.loaded = true;
        const raw = await this.options.storage.get(KEYS.queue);
        if (!raw)
            return;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.events = parsed.filter(isWireEvent);
            }
        }
        catch {
            // A corrupt queue file is dropped rather than retried forever. Keeping it
            // would mean every launch tries to parse the same broken JSON and no
            // event ever sends again — a permanent outage for one bad write.
            this.options.logger?.warn("mmp: stored queue was unreadable and was discarded");
            await this.options.storage.remove(KEYS.queue);
        }
    }
    async enqueue(event) {
        await this.load();
        this.events.push(event);
        this.stats.queued += 1;
        if (this.events.length > this.options.maxQueueSize) {
            const overflow = this.events.length - this.options.maxQueueSize;
            this.events.splice(0, overflow);
            this.stats.dropped += overflow;
            this.options.logger?.warn("mmp: queue full, dropped oldest events", {
                dropped: overflow,
            });
        }
        await this.persist();
    }
    get size() {
        return this.events.length;
    }
    /** Visible for tests and diagnostics; never for sending. */
    peek() {
        return this.events;
    }
    /**
     * Send what is queued.
     *
     * @param now  injected so backoff is testable without waiting.
     * @returns whether anything was accepted.
     */
    async flush(now = Date.now()) {
        await this.load();
        if (this.flushing || this.events.length === 0)
            return false;
        if (now < this.nextAttemptAt)
            return false;
        this.flushing = true;
        this.stats.flushes += 1;
        try {
            let accepted = false;
            // Loop so a large backlog drains in one flush rather than one batch per
            // interval, which after a long offline period would take hours.
            while (this.events.length > 0) {
                const batch = this.events.slice(0, this.options.batchSize);
                const outcome = await this.options.transport.send(batch);
                if (!this.applyOutcome(outcome, batch, now))
                    break;
                accepted = true;
            }
            await this.persist();
            return accepted;
        }
        finally {
            this.flushing = false;
        }
    }
    /** @returns whether to continue draining. */
    applyOutcome(outcome, batch, now) {
        if (outcome.kind === "accepted") {
            this.remove(batch);
            this.stats.sent += batch.length;
            this.failures = 0;
            this.nextAttemptAt = 0;
            return true;
        }
        if (outcome.kind === "rejected") {
            // Dropped, because the server has told us these will never be accepted.
            // Retrying a 4xx forever is an infinite loop pointed at someone else's
            // infrastructure, and it blocks every event queued behind it.
            this.remove(batch);
            this.stats.rejected += batch.length;
            this.options.logger?.error("mmp: server rejected events, dropping them", {
                count: batch.length,
                reason: outcome.reason,
            });
            return true;
        }
        this.failures += 1;
        this.nextAttemptAt = now + (outcome.retryAfterMs ?? this.backoff());
        this.options.logger?.debug("mmp: send failed, will retry", {
            reason: outcome.reason,
            failures: this.failures,
        });
        return false;
    }
    /**
     * Exponential backoff with full jitter.
     *
     * Jittered because every install of an app that was offline during an outage
     * comes back at the same moment. Without jitter they retry in lockstep and
     * the recovering server is knocked over by its own clients — the thundering
     * herd is caused by the retry policy, not by the outage.
     */
    backoff() {
        const random = this.options.random ?? Math.random;
        const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** (this.failures - 1), MAX_BACKOFF_MS);
        return Math.floor(random() * ceiling);
    }
    remove(batch) {
        const sent = new Set(batch.map((event) => event.event_id));
        this.events = this.events.filter((event) => !sent.has(event.event_id));
    }
    async persist() {
        if (this.events.length === 0) {
            await this.options.storage.remove(KEYS.queue);
            return;
        }
        await this.options.storage.set(KEYS.queue, JSON.stringify(this.events));
    }
}
function isWireEvent(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const candidate = value;
    return typeof candidate.event_id === "string" && typeof candidate.event_name === "string";
}
