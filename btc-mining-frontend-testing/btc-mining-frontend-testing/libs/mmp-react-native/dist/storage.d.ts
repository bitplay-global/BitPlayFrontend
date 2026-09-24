/**
 * Persistence.
 *
 * An interface rather than a hard dependency on AsyncStorage: an app may use
 * MMKV, or encrypted storage, or already have a store it wants this to live in,
 * and an SDK that dictates the answer gets rejected for it.
 *
 * Everything written here survives an app restart, and one thing must survive
 * a *reinstall* differently from the rest — see `identity.ts` on why the
 * anonymous id is deliberately not restored from a backup.
 */
export interface Storage {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
}
/**
 * In-memory storage. Used in tests, and as the fallback when an app has not
 * supplied one.
 *
 * As a fallback it is a real degradation and the SDK says so out loud: without
 * persistence every launch looks like a fresh install, which inflates install
 * counts and breaks attribution. It fails visibly rather than quietly
 * corrupting a customer's numbers.
 */
export declare class MemoryStorage implements Storage {
    private readonly values;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
}
/**
 * Wraps a storage that may throw.
 *
 * Device storage fails in the real world — full disks, corrupt databases,
 * a keystore locked while the phone is. None of that should crash the host
 * app: an analytics SDK taking down someone's checkout is a far worse outcome
 * than losing an event.
 */
export declare class SafeStorage implements Storage {
    private readonly inner;
    private readonly onError;
    constructor(inner: Storage, onError: (operation: string, error: unknown) => void);
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
}
export declare const KEYS: {
    readonly anonymousId: "mmp.anonymous_id";
    readonly userId: "mmp.user_id";
    readonly installReported: "mmp.install_reported";
    readonly queue: "mmp.queue";
    readonly consent: "mmp.consent";
    readonly session: "mmp.session";
    readonly deepLink: "mmp.deferred_deep_link";
};
/** The shape of AsyncStorage, MMKV's async wrapper, and most others. */
export interface KeyValueStore {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
/**
 * Adapts AsyncStorage — or anything with the same three methods — to `Storage`.
 *
 * Kept as an adapter rather than a dependency so the SDK ships with no runtime
 * dependencies at all. In React Native, where dependency resolution is the
 * hardest part of any upgrade, a measurement library that drags in its own copy
 * of a storage package is one that gets removed.
 *
 * ```ts
 * import AsyncStorage from "@react-native-async-storage/async-storage";
 * const storage = adaptKeyValueStore(AsyncStorage);
 * ```
 *
 * Whatever store you pass should be excluded from device backups where the
 * platform allows it — see the note in `identity.ts` on why a restored backup
 * can make two devices look like one.
 */
export declare function adaptKeyValueStore(store: KeyValueStore): Storage;
