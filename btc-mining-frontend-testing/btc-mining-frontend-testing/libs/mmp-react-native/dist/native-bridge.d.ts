/**
 * The JavaScript side of the native bridge.
 *
 * Everything here is defensive, because native modules fail in ways JavaScript
 * ones do not: the module can be stripped by a Proguard rule, the method can be
 * missing because the app is on an older build of the native package, the
 * promise can reject from a background thread, and on Android it can simply
 * never settle when Play Services is absent.
 *
 * The most important thing this layer does is treat an *opted-out* advertising
 * ID as no advertising ID. Both platforms answer an opt-out by returning the
 * all-zero UUID rather than by failing, so a naive integration reads
 * "00000000-0000-0000-0000-000000000000", decides it has an identifier, and
 * sends the same value for every opted-out device on earth. The server would
 * then match them all to each other. Checking for it here means the mistake
 * cannot be made by an app that wires the bridge up itself.
 */
import type { NativeBridge } from "./native";
export interface NativeModuleShape {
    getInstallReferrer?(): Promise<string | null>;
    getAdvertisingId?(): Promise<string | null>;
    getDeviceInfo?(): Promise<Record<string, unknown>>;
    updateConversionValue?(fineValue: number, coarseValue: string | null): Promise<boolean>;
}
/**
 * True when the value is a usable advertising identifier.
 *
 * Exported because it is the one piece of this file worth asserting directly:
 * getting it wrong is silent, and its consequence — every opted-out device
 * sharing one identifier — is exactly the outcome the opt-out exists to prevent.
 */
export declare function isUsableAdvertisingId(value: unknown): value is string;
/**
 * Wraps a native module — usually `NativeModules.MmpNative` — as a
 * `NativeBridge`.
 *
 * Passing `undefined` is a supported state, not an error: it is what a
 * JavaScript-only integration looks like, and what an app looks like before the
 * native side has been linked. The result is a bridge that answers "not
 * available" to everything.
 */
export declare function createNativeBridge(module: NativeModuleShape | undefined): NativeBridge;
