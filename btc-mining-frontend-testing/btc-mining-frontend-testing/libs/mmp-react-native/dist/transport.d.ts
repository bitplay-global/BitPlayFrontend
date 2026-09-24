/**
 * HTTP, and the classification of what came back.
 *
 * The important part is not the request, it is deciding what a failure means.
 * Three outcomes, and conflating any two of them loses data or duplicates it:
 *
 * - `accepted` — the server has it. Drop the events; sending again would be a
 *   duplicate the server has to deduplicate for us.
 * - `retry` — nobody knows yet. Network failures, timeouts, 5xx, 429. Keep the
 *   events and try later. Some of these *did* reach the server, which is
 *   exactly why every event carries a client-minted `event_id`: the retry is
 *   deduplicated server-side rather than becoming a double-counted purchase.
 * - `rejected` — the server understood and refused. A malformed batch or a
 *   revoked key. Retrying is pointless and an infinite loop against someone
 *   else's servers, so the events are dropped and the failure is reported.
 */
import type { ConversionMapping } from "./conversion";
import type { Logger, WireEvent } from "./types";
export type SendOutcome = {
    kind: "accepted";
} | {
    kind: "retry";
    reason: string;
    retryAfterMs?: number;
} | {
    kind: "rejected";
    reason: string;
    status: number;
};
export interface TransportOptions {
    endpoint: string;
    apiKey: string;
    timeoutMs?: number;
    logger?: Logger;
    fetchImpl?: typeof fetch;
}
export declare class Transport {
    private readonly options;
    private readonly fetchImpl;
    constructor(options: TransportOptions);
    send(events: WireEvent[]): Promise<SendOutcome>;
    /**
     * The deferred deep link handshake. Returns the destination, or null — and
     * treats a failure as "no destination" rather than surfacing it, because the
     * app is deciding which screen to open and blocking that on our availability
     * would make a first launch hang on our uptime.
     */
    resolveDeferredDeepLink(anonymousId: string): Promise<string | null>;
    /**
     * The advertiser's conversion value mapping.
     *
     * Returns null on any failure rather than throwing: without a mapping the SDK
     * simply reports no conversion values, which is a degradation, not a reason
     * for the host app to see an error.
     */
    fetchConversionValues(): Promise<ConversionMapping[] | null>;
    private get;
    private post;
    private request;
}
