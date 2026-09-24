/**
 * Who this device is, and who is using it.
 *
 * Two identifiers, deliberately separate:
 *
 * - `anonymous_id` is the device. Minted on first launch, persisted, and never
 *   derived from anything about the hardware. It is not a device fingerprint
 *   and not an advertising ID — it is a random value that means nothing outside
 *   this app, which is what makes it safe to keep without consent.
 * - `user_id` is the app's own identifier for the person, supplied by the app
 *   when they sign in. The SDK stores it and never invents one.
 *
 * A note on backups, because it is a real and under-discussed failure: on both
 * platforms the default storage is included in device backups, so restoring a
 * backup onto a second device can carry an `anonymous_id` with it and make two
 * devices look like one. Where the platform allows it, the storage backing this
 * SDK should be excluded from backup — `NSURLIsExcludedFromBackupKey` on iOS,
 * `android:allowBackup="false"` or a backup rule on Android. The SDK cannot
 * enforce that from JavaScript, so it is documented here and in the README
 * rather than silently assumed.
 */
import { type Storage } from "./storage";
import type { RandomSource } from "./uuid7";
/**
 * A session ends after this long without activity. Thirty minutes is the
 * convention across analytics tools; matching it means numbers here can be
 * compared with numbers from elsewhere without a footnote.
 */
export declare const SESSION_TIMEOUT_MS: number;
export declare class Identity {
    private readonly storage;
    private readonly random;
    private anonymousId;
    private userId;
    private session;
    constructor(storage: Storage, random: RandomSource);
    /** @returns whether the anonymous id was minted now — the signal for a first
     *  launch, used by install detection. */
    load(now?: number): Promise<{
        firstLaunch: boolean;
    }>;
    get deviceId(): string;
    get user(): string | null;
    /**
     * A fresh id for one event.
     *
     * Lives here because this class owns the random source. Minted once at track
     * time and then never regenerated — the server deduplicates on it, so a new
     * id on a retry would turn one purchase into two.
     */
    mintEventId(now?: number): string;
    setUserId(userId: string | null): Promise<void>;
    /**
     * The current session id, starting a new one if the last activity is old
     * enough. Called on every event, so it also records the activity.
     */
    touchSession(now?: number): Promise<string>;
    /**
     * Forget this device and start again.
     *
     * The honest response to a user asking not to be tracked any more: a new
     * anonymous id cannot be joined to the old one, so nothing recorded before
     * this point can be attributed to what comes after. The server-side erasure
     * endpoint deletes the history; this severs the future from it.
     */
    reset(now?: number): Promise<void>;
}
