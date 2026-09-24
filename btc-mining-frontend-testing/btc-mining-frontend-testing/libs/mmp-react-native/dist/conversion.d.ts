/**
 * SKAdNetwork conversion values.
 *
 * On iOS, a conversion value is the *only* thing an advertiser learns about
 * what someone did after installing: six bits, set before Apple's timer
 * expires, and then nothing. No event stream, no revenue figure. So the rules
 * around setting it are unusually unforgiving, and two of them are enforced
 * here because getting either wrong is silent.
 *
 * **Apple ignores a decrease.** `updatePostbackConversionValue` only ever moves
 * the value up. Calling it with a lower number is not an error and not a
 * rollback — it simply does nothing. An SDK that maps events to values and
 * calls on every event will therefore appear to work while quietly discarding
 * most of what it sends, so this tracks the high-water mark and only calls when
 * the value would actually change.
 *
 * **The timer restarts on every call.** Each update extends the measurement
 * window, which is useful when it is intended and expensive when it is not: a
 * chatty app that calls on every event delays its own postback. Calling only on
 * a genuine increase is what keeps that from happening by accident.
 *
 * The mapping itself comes from the server, because deciding what the 64 values
 * mean is the advertiser's modelling decision and it changes without an app
 * release.
 */
import { type Storage } from "./storage";
/** SKAdNetwork 4 coarse values, in Apple's order. */
export declare const COARSE_ORDER: readonly ["low", "medium", "high"];
export type CoarseValue = (typeof COARSE_ORDER)[number];
export interface ConversionMapping {
    event_name: string;
    conversion_value: number;
    coarse_value?: CoarseValue | null;
}
export interface ConversionUpdate {
    fineValue: number;
    coarseValue: CoarseValue | null;
}
/**
 * Decides whether an event should move the conversion value, and to what.
 *
 * Deliberately pure of any native call: what to send is a decision worth
 * testing on its own, separately from the platform API that sends it.
 */
export declare class ConversionValues {
    private readonly storage;
    private mappings;
    private state;
    private loaded;
    constructor(storage: Storage);
    load(): Promise<void>;
    setMappings(mappings: readonly ConversionMapping[]): void;
    get current(): ConversionUpdate;
    /**
     * @returns what to send to Apple, or null when this event would not move the
     *   value — either because it is unmapped, or because Apple would ignore it.
     */
    apply(eventName: string): Promise<ConversionUpdate | null>;
    /** For `reset()`, which severs a new identity from the old one. */
    clear(): Promise<void>;
}
