import { type NativeBridge } from "./native";
import { type Storage } from "./storage";
import { type ConsentUpdate, type MmpConfig, type TrackOptions } from "./types";
import { type RandomSource } from "./uuid7";
export interface ClientDependencies {
    storage?: Storage;
    native?: NativeBridge;
    random?: RandomSource;
    fetchImpl?: typeof fetch;
    now?: () => number;
}
export declare class MmpClient {
    private readonly logger;
    private readonly storage;
    private readonly native;
    private readonly identity;
    private readonly consent;
    private readonly conversions;
    private readonly queue;
    private readonly transport;
    private readonly now;
    private readonly config;
    private readonly trackWithoutConsent;
    private timer;
    private started;
    private device;
    private deferredDeepLink;
    constructor(config: MmpConfig, deps?: ClientDependencies);
    initialize(): Promise<void>;
    /**
     * The install event, sent exactly once per install.
     *
     * Guarded by a persisted flag rather than by "is this the first launch",
     * because those differ: an install whose event failed to send must still be
     * reported on the next launch, and a device that was merely cleared of its
     * queue must not be reported twice.
     */
    private reportInstallOnce;
    /**
     * Requested from the platform only when the purpose is granted. A denial
     * means the identifier is never read — which is a stronger guarantee than
     * reading it and choosing not to send it.
     */
    private advertisingId;
    track(eventName: string, options?: TrackOptions): Promise<void>;
    private loadConversionMappings;
    /**
     * Tells Apple about this event, if it would move the value.
     *
     * The decision is made in `ConversionValues` rather than here, and it matters
     * that it is made at all: Apple ignores a decrease instead of reporting one,
     * and every accepted call restarts the measurement window — so an SDK that
     * called on every event would look like it was working while discarding most
     * of what it sent, and would delay its own postback doing it.
     */
    private reportConversion;
    setUserId(userId: string | null): Promise<void>;
    setConsent(update: ConsentUpdate): Promise<void>;
    /**
     * Where this install was originally headed, if it came from a deep link.
     *
     * Returns null rather than waiting when the answer is not known — the app is
     * choosing which screen to show, and blocking that on a network call would
     * make a first launch hang on our availability.
     */
    getDeferredDeepLink(): Promise<string | null>;
    flush(): Promise<void>;
    /** Severs future data from everything recorded before now. Server-side
     *  deletion is a separate request to the privacy API. */
    reset(): Promise<void>;
    shutdown(): Promise<void>;
    get stats(): import("./queue").QueueStats;
    private startTimer;
    private enqueue;
}
