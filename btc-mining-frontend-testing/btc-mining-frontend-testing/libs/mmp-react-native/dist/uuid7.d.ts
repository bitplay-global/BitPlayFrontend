/**
 * UUIDv7 (RFC 9562), minted on the device.
 *
 * The same identifier format the backend uses, for the same reason: the first
 * 48 bits are a millisecond timestamp, so ids generated near each other in time
 * sort near each other, and the rows they become land near each other in an
 * index instead of scattering across it.
 *
 * Two of these matter more than the rest:
 *
 * - `event_id` is the idempotency key. The server deduplicates on it, so an
 *   event that is retried after an ambiguous failure is stored once. That only
 *   works if the id is minted before the first attempt and kept across retries
 *   and app restarts — never regenerated.
 * - `anonymous_id` is the device's identity. A collision here does not lose
 *   data, it *merges two people*, so this module refuses to mint one without a
 *   real source of randomness rather than quietly falling back to Math.random.
 */
/** Injected in tests; in an app this is the platform's CSPRNG. */
export interface RandomSource {
    fill(bytes: Uint8Array): void;
}
export declare class InsecureRandomError extends Error {
    constructor();
}
/**
 * The platform's CSPRNG, or a thrower.
 *
 * Deliberately not falling back to Math.random. A weak `anonymous_id` merges
 * two users' data into one person's profile, and a weak `event_id` lets the
 * server's deduplication drop a real event as a duplicate of an unrelated one.
 * Both are silent, and both are worse than an SDK that refuses to start and
 * says why.
 */
export declare function platformRandom(): RandomSource;
/**
 * @param now  milliseconds since the epoch — a parameter so tests can pin it.
 */
export declare function uuid7(random: RandomSource, now?: number): string;
