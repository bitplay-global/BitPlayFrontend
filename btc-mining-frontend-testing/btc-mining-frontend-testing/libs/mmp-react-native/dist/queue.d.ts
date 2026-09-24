/**
 * The event queue: persistent, bounded, and idempotent under retry.
 *
 * This is where mobile SDKs lose data or double-count it, so the ordering of
 * operations is the design:
 *
 * 1. An event is persisted *before* any attempt to send it. A crash between
 *    tracking and sending loses nothing.
 * 2. Events are removed only after the server has accepted them, or explicitly
 *    rejected them. An ambiguous outcome keeps them.
 * 3. Because step 2 keeps events that may already have arrived, every event
 *    carries a `event_id` minted once at track time and never regenerated. The
 *    server deduplicates on it. Regenerating the id on retry — which is easy to
 *    do by accident — turns one purchase into two in a revenue report.
 *
 * The queue is bounded because an app that is offline for a week must not grow
 * until the OS kills it. When it is full the *oldest* events are dropped: the
 * newest are the ones still worth having, and a drop is reported rather than
 * hidden.
 *
 * Exactly one flush runs at a time. Two concurrent flushes would read the same
 * events and send both copies, which is a duplicate the server would have to
 * absorb on every single flush rather than only after a real failure.
 */
import type { Logger, WireEvent } from "./types";
import { type Storage } from "./storage";
import type { Transport } from "./transport";
export interface QueueOptions {
    storage: Storage;
    transport: Transport;
    batchSize: number;
    maxQueueSize: number;
    logger?: Logger;
    /** Injected so tests do not sleep. */
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
}
export interface QueueStats {
    queued: number;
    sent: number;
    dropped: number;
    rejected: number;
    flushes: number;
}
export declare class EventQueue {
    private readonly options;
    private events;
    private loaded;
    private flushing;
    /** Consecutive failures, for backoff. Reset by any success. */
    private failures;
    private nextAttemptAt;
    readonly stats: QueueStats;
    constructor(options: QueueOptions);
    load(): Promise<void>;
    enqueue(event: WireEvent): Promise<void>;
    get size(): number;
    /** Visible for tests and diagnostics; never for sending. */
    peek(): readonly WireEvent[];
    /**
     * Send what is queued.
     *
     * @param now  injected so backoff is testable without waiting.
     * @returns whether anything was accepted.
     */
    flush(now?: number): Promise<boolean>;
    /** @returns whether to continue draining. */
    private applyOutcome;
    /**
     * Exponential backoff with full jitter.
     *
     * Jittered because every install of an app that was offline during an outage
     * comes back at the same moment. Without jitter they retry in lockstep and
     * the recovering server is knocked over by its own clients — the thundering
     * herd is caused by the retry policy, not by the outage.
     */
    private backoff;
    private remove;
    private persist;
}
