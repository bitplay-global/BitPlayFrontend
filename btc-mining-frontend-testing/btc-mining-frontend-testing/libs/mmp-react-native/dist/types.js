/** Public types. These mirror the server's ingest contract exactly. */
/** Limits copied from mmp_ingest.schema, so the SDK refuses what the server
 *  would refuse — locally, where the developer sees it, rather than as a 422
 *  in production. */
export const LIMITS = {
    eventName: 120,
    id: 255,
    propertiesBytes: 16 * 1024,
    eventsPerBatch: 100,
};
/**
 * Reserved on the server. `install` drives attribution, `login`/`signup` drive
 * identity resolution, and `consent_update` carries a consent decision — the
 * SDK sends all four itself, so an app sending one by hand would corrupt state
 * it does not own.
 */
export const RESERVED_EVENTS = ["install", "login", "signup", "consent_update"];
/**
 * Fold an event name to the form reserved names are matched on — lowercase,
 * separators removed. Mirrors `canonical_event_name` on the server, and the
 * contract test asserts the two agree.
 *
 * The name is only folded for *matching*. What gets sent is what you passed.
 */
export function canonicalEventName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
