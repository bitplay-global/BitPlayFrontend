/** Used when no native module is present. Every call is a no-op returning the
 *  "not available" answer, so no caller needs to branch on its absence. */
export const NO_NATIVE = {
    async getInstallReferrer() {
        return null;
    },
    async getAdvertisingId() {
        return null;
    },
    async getDeviceInfo() {
        return {};
    },
    async updateConversionValue() {
        return false;
    },
};
/**
 * Calls a native method that may be absent, may reject, or may hang.
 *
 * All three happen: a module removed by a Proguard rule, a permission dialogue
 * the user dismissed, a Play Services call that never returns on a device with
 * no Play Services. None of them should stop the SDK initialising, so each is
 * bounded and each failure produces the same "not available" answer.
 */
export async function callNative(call, fallback, timeoutMs = 3_000) {
    if (typeof call !== "function")
        return fallback;
    try {
        return await Promise.race([
            call(),
            new Promise((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
        ]);
    }
    catch {
        return fallback;
    }
}
