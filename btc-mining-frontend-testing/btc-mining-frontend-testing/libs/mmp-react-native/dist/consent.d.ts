/**
 * Consent, held on the device and reported to the server.
 *
 * The SDK's job is narrow and it matters that it stays narrow: it does not
 * decide what consent is required, does not show a dialogue, and does not
 * interpret a jurisdiction. The app tells it what the user chose, and it
 * reports that unchanged. Anything cleverer would put a legal judgement inside
 * a library that cannot see the context it is being made in.
 *
 * What it does enforce is local: when `advertising` is not granted, the
 * advertising ID is never requested from the platform in the first place. The
 * server also minimises on the way in, so this is the second of two
 * independent checks — but it is the one that stops the identifier ever being
 * read, which is stronger than not sending it.
 */
import { type Storage } from "./storage";
import type { ConsentUpdate, Purpose } from "./types";
export declare class Consent {
    private readonly storage;
    private states;
    constructor(storage: Storage);
    load(): Promise<void>;
    /** @returns the purposes that actually changed, so the SDK does not send a
     *  consent event every launch for a decision it already reported. */
    update(update: ConsentUpdate): Promise<ConsentUpdate>;
    /** Granted only if explicitly granted. Unknown is not a yes. */
    allows(purpose: Purpose): boolean;
    get known(): boolean;
    snapshot(): ConsentUpdate;
}
