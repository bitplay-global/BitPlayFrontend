/**
 * @mmp/react-native — mobile measurement for React Native.
 *
 * ```ts
 * import { MMP } from "@mmp/react-native";
 * import AsyncStorage from "@react-native-async-storage/async-storage";
 *
 * await MMP.initialize(
 *   { apiKey: "pk_live_...", endpoint: "https://track.example.com" },
 *   { storage: adaptKeyValueStore(AsyncStorage) },
 * );
 *
 * await MMP.track("purchase", { revenueMinor: 499, currency: "USD" });
 * ```
 *
 * The module-level `MMP` is a convenience for the overwhelmingly common case of
 * one app sending to one endpoint. `MmpClient` is exported for tests and for
 * anyone who needs two.
 */
import { MmpClient, type ClientDependencies } from "./client";
import type { MmpConfig } from "./types";
export { MmpClient } from "./client";
export { MemoryStorage, adaptKeyValueStore, type KeyValueStore, type Storage, } from "./storage";
export { InsecureRandomError } from "./uuid7";
export { ConversionValues, COARSE_ORDER } from "./conversion";
export type { CoarseValue, ConversionMapping } from "./conversion";
export type { NativeBridge, DeviceInfo } from "./native";
export { createNativeBridge, isUsableAdvertisingId, type NativeModuleShape, } from "./native-bridge";
export type { ConsentState, ConsentUpdate, EventProperties, Logger, MmpConfig, Purpose, TrackOptions, } from "./types";
export declare const MMP: {
    initialize(config: MmpConfig, deps?: ClientDependencies): Promise<void>;
    track: (name: string, options?: {}) => Promise<void>;
    setUserId: (userId: string | null) => Promise<void>;
    setConsent: (update: Parameters<MmpClient["setConsent"]>[0]) => Promise<void>;
    getDeferredDeepLink: () => Promise<string | null>;
    flush: () => Promise<void>;
    reset: () => Promise<void>;
    shutdown(): Promise<void>;
};
