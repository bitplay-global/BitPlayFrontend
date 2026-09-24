/** What a platform returns when the user has opted out. Not an identifier. */
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
/**
 * True when the value is a usable advertising identifier.
 *
 * Exported because it is the one piece of this file worth asserting directly:
 * getting it wrong is silent, and its consequence — every opted-out device
 * sharing one identifier — is exactly the outcome the opt-out exists to prevent.
 */
export function isUsableAdvertisingId(value) {
    if (typeof value !== "string")
        return false;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase() === ZERO_UUID)
        return false;
    // Some devices return "null" or "unknown" as a literal string rather than a
    // null value, which then reads as a perfectly good identifier.
    if (["null", "undefined", "unknown", "none"].includes(trimmed.toLowerCase()))
        return false;
    return true;
}
function cleanString(value) {
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
/**
 * Wraps a native module — usually `NativeModules.MmpNative` — as a
 * `NativeBridge`.
 *
 * Passing `undefined` is a supported state, not an error: it is what a
 * JavaScript-only integration looks like, and what an app looks like before the
 * native side has been linked. The result is a bridge that answers "not
 * available" to everything.
 */
export function createNativeBridge(module) {
    if (!module)
        return {};
    const bridge = {};
    if (typeof module.getInstallReferrer === "function") {
        bridge.getInstallReferrer = async () => {
            const referrer = await module.getInstallReferrer();
            return cleanString(referrer) ?? null;
        };
    }
    if (typeof module.getAdvertisingId === "function") {
        bridge.getAdvertisingId = async () => {
            const id = await module.getAdvertisingId();
            return isUsableAdvertisingId(id) ? id : null;
        };
    }
    if (typeof module.getDeviceInfo === "function") {
        bridge.getDeviceInfo = async () => {
            const info = (await module.getDeviceInfo()) ?? {};
            const platform = info["platform"];
            const result = {};
            // Rebuilt field by field rather than passed through. A native module is
            // free to return anything, and spreading it would put whatever it invented
            // into the event payload — where the server rejects unknown fields and the
            // whole batch fails.
            if (platform === "android" || platform === "ios")
                result.platform = platform;
            const osVersion = cleanString(info["osVersion"]);
            if (osVersion)
                result.osVersion = osVersion;
            const appVersion = cleanString(info["appVersion"]);
            if (appVersion)
                result.appVersion = appVersion;
            const deviceModel = cleanString(info["deviceModel"]);
            if (deviceModel)
                result.deviceModel = deviceModel;
            return result;
        };
    }
    if (typeof module.updateConversionValue === "function") {
        bridge.updateConversionValue = async (fineValue, coarseValue) => {
            // Clamped here as well as server-side. Apple rejects the whole update for
            // an out-of-range value rather than clamping it, and the SDK cannot see
            // the rejection on iOS 14, so an out-of-range value would be lost in
            // silence.
            const clamped = Math.max(0, Math.min(63, Math.trunc(fineValue)));
            return (await module.updateConversionValue(clamped, coarseValue)) === true;
        };
    }
    return bridge;
}
