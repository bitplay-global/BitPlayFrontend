/**
 * Sends the signed-in user's token -- and the app's identity headers
 * (getMobileSecurityHeaders: app id, platform, version, build, device id) --
 * with every backend API call. The headers used to be attached by hand to ~13
 * of ~100 calls, so most requests could not be told apart from a script
 * posing as the app, and the backend could not see which build a user runs.
 *
 * The backend (dashboard.bitplaypro.com/api) used to take the acting user from
 * `userId` in the URL or body, so any caller could act as any user. It now
 * verifies this token and only lets a request act as the user it names. The
 * app makes ~100 separate fetch/axios calls, so rather than edit each one, this
 * installs once at startup and covers them all -- including calls added later.
 *
 * Scope is deliberately narrow:
 *   - only https://dashboard.bitplaypro.com/api/... (the auth service under
 *     /mobile_api already receives tokens where it needs them)
 *   - never overrides an Authorization header a caller set itself
 *
 * A 401 carrying one of the backend's token codes means the session is no
 * longer valid, so it is routed to the app's existing "sign in again" handler
 * instead of leaving screens failing silently.
 */
import axios from 'axios';
import { getSession } from '../auth/auth';
import { SERVER_BASE_URL, notifyAuthExpired, getMobileSecurityHeaders } from './api';

const BACKEND_API_PREFIX = `${SERVER_BASE_URL}/api/`;
const SESSION_CODES = new Set(['INVALID_TOKEN', 'AUTH_REQUIRED', 'MFA_REQUIRED']);

function isBackendApi(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(BACKEND_API_PREFIX);
}

function currentToken(): string | null {
  try {
    const t = getSession();
    return typeof t === 'string' && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

function hasHeader(headers: any, name: string): boolean {
  if (!headers) return false;
  if (typeof headers.has === 'function') return headers.has(name);
  const lower = name.toLowerCase();
  return Object.keys(headers).some(k => k.toLowerCase() === lower);
}

function hasAuthorization(headers: any): boolean {
  return hasHeader(headers, 'Authorization');
}

/** The app's identity headers the caller has not already set itself. */
function missingAppHeaders(headers: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(getMobileSecurityHeaders())) {
    if (!hasHeader(headers, k)) out[k] = v;
  }
  return out;
}

let installed = false;

export function installBackendAuth() {
  if (installed) return;
  installed = true;

  // Written through an untyped reference on purpose: assigning to the typed
  // `global.fetch` changes TypeScript's view of the global scope and broke
  // unrelated navigationRef.navigate() calls in App.tsx.
  const g = globalThis as any;
  const originalFetch: typeof fetch = g.fetch.bind(g);
  g.fetch = (async (input: any, init: any = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (!isBackendApi(url)) return originalFetch(input, init);

    const token = currentToken();
    const base = init?.headers && typeof init.headers.forEach === 'function'
      ? Object.fromEntries((init.headers as any).entries?.() ?? [])
      : { ...(init?.headers || {}) };
    const extra: Record<string, string> = missingAppHeaders(base);
    if (token && !hasAuthorization(base)) extra.Authorization = `Bearer ${token}`;
    const nextInit = { ...init, headers: { ...base, ...extra } };

    const res = await originalFetch(input, nextInit);
    if (res.status === 401 && token) {
      try {
        const body = await res.clone().json();
        if (SESSION_CODES.has(body?.code)) notifyAuthExpired();
      } catch {
        // Non-JSON 401: not one of ours, leave it to the caller.
      }
    }
    return res;
  });

  axios.interceptors.request.use(config => {
    const url = config.url?.startsWith('http') ? config.url : `${config.baseURL ?? ''}${config.url ?? ''}`;
    if (isBackendApi(url)) {
      const token = currentToken();
      const extra: Record<string, string> = missingAppHeaders(config.headers);
      if (token && !hasAuthorization(config.headers)) extra.Authorization = `Bearer ${token}`;
      for (const [k, v] of Object.entries(extra)) {
        if (typeof (config.headers as any)?.set === 'function') (config.headers as any).set(k, v);
        else (config.headers as any) = { ...(config.headers as any), [k]: v };
      }
    }
    return config;
  });

  axios.interceptors.response.use(undefined, error => {
    const res = error?.response;
    const url = res?.config?.url;
    if (res?.status === 401 && isBackendApi(url) && SESSION_CODES.has(res?.data?.code) && currentToken()) {
      notifyAuthExpired();
    }
    return Promise.reject(error);
  });
}

installBackendAuth();
