/**
 * API Configuration
 * Centralized configuration for all API endpoints
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/** Enable verbose API logging. Uses __DEV__ in RN; set to true to force in release. */
export const DEBUG_API = typeof __DEV__ !== 'undefined' ? __DEV__ : true;

const SENSITIVE_KEYS = ['password', 'token', 'authorization', 'cookie', 'secret'];

function redact(obj: any): any {
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

function formatLog(label: string, data: object) {
  if (!DEBUG_API) return;
  console.log(`[API ${label}]`, JSON.stringify(data, null, 2));
}

// Production API URL (Render deployment) - Working live server

const PRODUCTION_SERVER_URL = 'https://dashboard.bitplaypro.com';
const PRODUCTION_API_URL = `${PRODUCTION_SERVER_URL}/mobile_api`;
const MOBILE_APP_ID = 'bitplay-mobile';

// Development API URLs (for local testing with cloud database)
const DEVELOPMENT_API_URLS = {
  LOCAL_IP: 'http://192.168.29.144:5001',
  LOCALHOST: 'http://localhost:5001',
  ANDROID_EMULATOR: 'http://10.0.2.2:5001',
};

const DEV_DATA_SERVER_URLS = {
  LOCAL_IP: 'http://192.168.29.144:3001',
  LOCALHOST: 'http://localhost:3001',
  ANDROID_EMULATOR: 'http://10.0.2.2:3001',
};

const ALLOWED_API_HOSTS = [
  'dashboard.bitplaypro.com',
  'localhost',
  '10.0.2.2',
  '192.168.29.144',
];

const MOBILE_SECURITY_HEADERS: Record<string, string> = {
  'x-app-id': MOBILE_APP_ID,
  'x-app-platform': Platform.OS,
  'x-app-version': DeviceInfo.getVersion(),
  'x-device-id': DeviceInfo.getUniqueIdSync(),
  'x-mobile-client': 'true',
};

const shouldAttachMobileHeaders = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    const hasApiPath = parsed.pathname.startsWith('/api') || parsed.pathname.startsWith('/mobile_api');
    return ALLOWED_API_HOSTS.includes(parsed.hostname) && hasApiPath;
  } catch {
    return false;
  }
};

const attachMobileSecurityHeaders = (
  headers: Record<string, string>,
  url: string
): Record<string, string> => {
  if (!shouldAttachMobileHeaders(url)) {
    return headers;
  }
  return {
    ...headers,
    ...MOBILE_SECURITY_HEADERS,
  };
};

export const getMobileSecurityHeaders = (): Record<string, string> => ({
  ...MOBILE_SECURITY_HEADERS,
});

// Use production Render backend with cloud database (MongoDB Atlas)
// This provides live server with cloud data persistence - fully deployed solution
// export const API_BASE_URL = DEVELOPMENT_API_URLS.LOCALHOST;
export const API_BASE_URL = PRODUCTION_API_URL;

// Data endpoints server (btc-mining-backend on port 3001)
// const SERVER_URL = DEV_DATA_SERVER_URLS.LOCALHOST;
const SERVER_URL = PRODUCTION_SERVER_URL;

export const DATA_ENDPOINTS = {
  CREATE_WITHDRAWAL: '/api/withdrawals',
  GET_TRANSACTIONS: '/api/transactions/all',
  GET_RECENT_TRANSACTIONS: '/api/transactions/last7days',
  GET_BALANCE_HISTORY: '/api/wallet/history',
  SET_WALLET_BALANCE: '/api/wallet/balance',
  GET_WALLET_BALANCE: '/api/wallet/balance', 
  GET_DEPOSIT_ADDRESS: '/api/deposit-address',
  GET_DEPOSIT_ADDRESSES: '/api/deposit-address/',
  GET_FAQS: '/api/faqs',
  CREATE_SPEED_TRANSACTION: '/api/withdrawals/create-speed-payment',
  GET_REWARDS: '/api/daily-rewards',
  GET_SUBSCRIPTIONS: '/api/subscriptionplans',
  BUY_SUBSCRIPTION: '/api/subscriptionplans/create_user_sub',
  GET_USER_HASHPOWER: '/api/subscriptionplans/hashpower',
  CREATE_SUPPORT_TICKET: '/api/help/create',
  REFERRALS: '/api/referrals',
  REFERRAL_REWARDS: '/api/referrals/rewards',
  CREATE_FCM: '/api/firebase_tokens/create',
  TEST_NOTIFICATION: '/api/firebase_tokens/test-notification',
  MINING_STOPPED: '/api/firebase_tokens/mining-stopped',
  CUSTOM_NOTIFICATION: '/api/firebase_tokens/custom-notification',
  PROCESS_SPEED_TRANSACTION: '/api/lightning-handles/pay-invoice',
  GOOGLE_ADS_IDS: '/api/google-ads/ids',
  NEWS: '/api/news',
  GET_WITHDRAWAL_LIMITS: '/api/withdrawals/limits',
  DELETE_REQ: '/api/delete-handles/create',
  TWOFACTORSTATUS: '/api/security/2fa-status',
  CHANGETWOFACTORSTATUS: '/api/security/switch',      
  USERMININGDETAILS: '/api/user_mining',
  TRADING_HISTORY: '/api/user_mining/trading-history',
  TRADING_CLAIM: '/api/user_mining/trading-claim',
  SPIN_HISTORY: '/api/user_mining/spin-history',
  SPIN_HISTORY_CLAIM: '/api/user_mining/spin-history/claim',
  MEMORY_HISTORY: '/api/user_mining/memory-history',
  MEMORY_HISTORY_CLAIM: '/api/user_mining/memory-history/claim',
  USERDAILYREWARD: '/api/claim_daily_miner',
  SYNC_PURCHASE: '/api/purchases',
  PRIVILEGES: '/api/privileges',

  NOTIFICATION_PREFS: '/api/notification-preferences',

  MINING_SESSION_START: '/api/mining-sessions/start',
  MINING_SESSION_UPDATE: '/api/mining-sessions/update',
  MINING_SESSION_STOP: '/api/mining-sessions/stop',
  MINING_SESSION_STATUS: '/api/mining-sessions/status',

  GAME_SESSIONS_SUBMIT: '/api/game-sessions',
  GAME_SESSIONS_POPULAR: '/api/game-sessions/popular',
} as const;

type DataEndpointKey = keyof typeof DATA_ENDPOINTS;

export const get_data_uri = (endpoint: DataEndpointKey): string => {
  return `${SERVER_URL}${DATA_ENDPOINTS[endpoint]}`;
};

/**
 * Debug wrapper around fetch. Use when debugging calls that use get_data_uri + fetch.
 * Logs url, method, status, elapsed ms, and response body (redacted).
 * Only logs when DEBUG_API is true.
 */
export const debugFetch: typeof fetch = async (input, init?) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = (init?.method || 'GET').toUpperCase();
  const mergedHeaders = attachMobileSecurityHeaders(
    ((init?.headers as Record<string, string>) || {}),
    url
  );
  const config = {
    ...init,
    headers: mergedHeaders,
  };
  const start = Date.now();
  if (DEBUG_API) {
    formatLog('Fetch Request', { url, method });
  }
  try {
    const res = await fetch(input, config);
    const elapsed = Date.now() - start;
    let body: any = null;
    const clone = res.clone();
    try {
      body = await clone.json();
    } catch {
      body = '(non-JSON)';
    }
    if (DEBUG_API) {
      formatLog('Fetch Response', {
        url,
        method,
        status: res.status,
        ok: res.ok,
        elapsedMs: elapsed,
        data: body != null && typeof body === 'object' ? redact(body) : body,
      });
    }
    return res;
  } catch (e: any) {
    if (DEBUG_API) {
      console.error('[API Fetch Error]', { url, method, message: e?.message });
    }
    throw e;
  }
};

// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  REGISTER: '/api/auth/register',
  REFERRALS: '/api/referrals',
  SOCIAL_LOGIN: '/api/auth/social-login',
  ME: '/api/auth/me',
  REFERRAL_CLAIM: '/api/auth/referral/claim',
  UPDATE_PROFILE: '/api/auth/update-profile',
  UPLOAD_PROFILE_IMAGE: '/api/profile-image/upload',
  GET_PROFILE_IMAGE: '/api/profile-image',
  FORGOT_PASSWORD: '/api/auth/forgotpassword',
  RESET_PASSWORD: '/api/auth/resetpassword', // PUT /api/auth/resetpassword/:resettoken
  VERIFY_EMAIL: '/api/auth/verify-email', // GET /api/auth/verify-email/:token
  VERIFY_EMAIL_OTP: '/api/auth/verify-email-otp', // GET /api/auth/verify-email-otp/:otp
  RESEND_VERIFICATION: '/api/auth/resend-verification',
  UPDATE_EMAIL_OTP: '/api/auth/update-email-otp',
  UPDATE_EMAIL: '/api/auth/update-email',
  TWOFACTOROTP: '/api/auth/two-factor-otp',
  VERIFYTWOFACTOROTP: '/api/auth/verify-twofactorotp',

  // Health Check
  HEALTH: '/api/health',

  // Support (if implemented)
  SUPPORT_CONTACT: '/api/support/contact',
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

/**
 * Session-expiry handling.
 *
 * The backend JWT eventually expires, and until now nothing detected that
 * centrally -- whichever screen happened to make the next authenticated call
 * (often the Profile screen, since it fetches on every focus) would just
 * surface the raw backend message ("Token is not valid") in a bare
 * Alert.alert, leaving the user stuck on a screen that can never load while
 * the app still believed it was logged in. Logging out and back in "fixed"
 * it only because that mints a fresh token.
 *
 * AuthProvider registers a handler here (clear session + flip
 * `authenticated` to false) so ANY 401/invalid-token response, from ANY
 * screen, forces a clean return to the login flow instead of a dead end.
 */
let authExpiredHandler: (() => void) | null = null;
let authExpiryInFlight = false;

export const setAuthExpiredHandler = (fn: (() => void) | null) => {
  authExpiredHandler = fn;
};

const AUTH_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

const isAuthExpiredResponse = (status: number, message: string | undefined): boolean => {
  if (status === 401) return true;
  const m = (message || '').toLowerCase();
  return m.includes('token') && (m.includes('not valid') || m.includes('invalid') || m.includes('expired'));
};

const handleAuthExpired = () => {
  if (authExpiryInFlight) return;
  authExpiryInFlight = true;
  try {
    authExpiredHandler?.();
  } finally {
    // Reset shortly after -- guards against a burst of parallel 401s
    // triggering logout() repeatedly, without permanently wedging it off.
    setTimeout(() => {
      authExpiryInFlight = false;
    }, 2000);
  }
};

// API Configuration
export const API_CONFIG = {
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// Helper function for making API requests
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
): Promise<any> => {
  const url = getApiUrl(endpoint);
  const method = (options.method || 'GET').toUpperCase();

  const config: RequestInit = {
    ...options,
    headers: {
      ...API_CONFIG.headers,
      ...(options.headers as Record<string, string>),
    },
  };
  config.headers = attachMobileSecurityHeaders(
    config.headers as Record<string, string>,
    url
  );

  let bodyJson: any = null;
  if (options.body && typeof options.body === 'string') {
    try {
      bodyJson = JSON.parse(options.body);
    } catch {
      bodyJson = '(non-JSON body)';
    }
  }

  const start = Date.now();
  if (DEBUG_API) {
    formatLog('Request', {
      url,
      method,
      endpoint,
      body: bodyJson != null ? redact(bodyJson) : undefined,
    });
  }

  try {
    const response = await fetch(url, config);
    const elapsed = Date.now() - start;

    const data = await response.json();

    if (DEBUG_API) {
      formatLog('Response', {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        elapsedMs: elapsed,
        data: redact(data),
      });
    }

    // Special handling for 403 status (email verification required)
    if (response.status === 403 && data.emailVerified === false) {
      return data;
    }

    if (!response.ok) {
      const errorMessage =
        data.message || `HTTP error! status: ${response.status}`;
      if (DEBUG_API) {
        console.error('[API Error Response]', { url, status: response.status, data: redact(data) });
      }
      if (isAuthExpiredResponse(response.status, data.message)) {
        handleAuthExpired();
        throw new Error(AUTH_EXPIRED_MESSAGE);
      }
      throw new Error(errorMessage);
    }

    return data;
  } catch (error: any) {
    const elapsed = Date.now() - start;
    if (DEBUG_API) {
      console.error('[API Request Error]', {
        message: error.message,
        url,
        method,
        elapsedMs: elapsed,
      });
    }

    if (
      error.message.includes('Network request failed') ||
      error.message.includes('fetch')
    ) {
      throw new Error(
        `Cannot connect to server at ${API_BASE_URL}. Please check your internet connection and make sure the server is running.`,
      );
    }

    throw error;
  }
};

/** Axios instance with request/response logging. Use for debugging; same base URL as apiRequest. */
export const apiClient: AxiosInstance = (() => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_CONFIG.timeout,
    headers: API_CONFIG.headers as Record<string, string>,
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (!DEBUG_API) return config;
      const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      (config as any).__apiDebugId = reqId;
      formatLog('Axios Request', {
        id: reqId,
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        params: config.params,
        data: config.data != null ? redact(config.data) : undefined,
      });
      const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
      // Adds the mobile security headers (if this URL gets them) without
      // replacing the AxiosHeaders instance axios expects.
      config.headers.set(attachMobileSecurityHeaders({}, fullUrl));
      return config;
    },
    (err) => {
      if (DEBUG_API) console.error('[API Axios Request Error]', err);
      return Promise.reject(err);
    }
  );

  client.interceptors.response.use(
    (response) => {
      if (!DEBUG_API) return response;
      const reqId = (response.config as any).__apiDebugId;
      formatLog('Axios Response', {
        id: reqId,
        status: response.status,
        url: response.config.url,
        data: redact(response.data),
      });
      return response;
    },
    (err) => {
      if (DEBUG_API) {
        const reqId = err.config?.__apiDebugId;
        console.error('[API Axios Response Error]', {
          id: reqId,
          message: err.message,
          url: err.config?.url,
          status: err.response?.status,
          data: err.response?.data != null ? redact(err.response.data) : undefined,
        });
      }
      const status = err.response?.status;
      const message = err.response?.data?.message;
      if (status != null && isAuthExpiredResponse(status, message)) {
        handleAuthExpired();
        return Promise.reject(new Error(AUTH_EXPIRED_MESSAGE));
      }
      return Promise.reject(err);
    }
  );

  return client;
})();

export const SERVER_BASE_URL = PRODUCTION_SERVER_URL;

/** Lets the backend-auth wrapper send a dead session back to the login flow. */
export const notifyAuthExpired = () => handleAuthExpired();

export default {
  API_BASE_URL,
  SERVER_BASE_URL,
  API_ENDPOINTS,
  getApiUrl,
  apiRequest,
  get_data_uri,
  debugFetch,
  DATA_ENDPOINTS,
  DEBUG_API,
  apiClient,
};
