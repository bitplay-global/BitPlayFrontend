/**
 * In-memory storage. Used in tests, and as the fallback when an app has not
 * supplied one.
 *
 * As a fallback it is a real degradation and the SDK says so out loud: without
 * persistence every launch looks like a fresh install, which inflates install
 * counts and breaks attribution. It fails visibly rather than quietly
 * corrupting a customer's numbers.
 */
export class MemoryStorage {
    values = new Map();
    async get(key) {
        return this.values.get(key) ?? null;
    }
    async set(key, value) {
        this.values.set(key, value);
    }
    async remove(key) {
        this.values.delete(key);
    }
}
/**
 * Wraps a storage that may throw.
 *
 * Device storage fails in the real world — full disks, corrupt databases,
 * a keystore locked while the phone is. None of that should crash the host
 * app: an analytics SDK taking down someone's checkout is a far worse outcome
 * than losing an event.
 */
export class SafeStorage {
    inner;
    onError;
    constructor(inner, onError) {
        this.inner = inner;
        this.onError = onError;
    }
    async get(key) {
        try {
            return await this.inner.get(key);
        }
        catch (error) {
            this.onError("get", error);
            return null;
        }
    }
    async set(key, value) {
        try {
            await this.inner.set(key, value);
        }
        catch (error) {
            this.onError("set", error);
        }
    }
    async remove(key) {
        try {
            await this.inner.remove(key);
        }
        catch (error) {
            this.onError("remove", error);
        }
    }
}
export const KEYS = {
    anonymousId: "mmp.anonymous_id",
    userId: "mmp.user_id",
    installReported: "mmp.install_reported",
    queue: "mmp.queue",
    consent: "mmp.consent",
    session: "mmp.session",
    deepLink: "mmp.deferred_deep_link",
};
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
export function adaptKeyValueStore(store) {
    return {
        get: (key) => store.getItem(key),
        set: (key, value) => store.setItem(key, value),
        remove: (key) => store.removeItem(key),
    };
}
