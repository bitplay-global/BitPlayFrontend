/**
 * Sends the signed-in user's token with every backend API call.
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
import { SERVER_BASE_URL, notifyAuthExpired } from './api';

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

function hasAuthorization(headers: any): boolean {
  if (!headers) return false;
  if (typeof headers.has === 'function') return headers.has('Authorization');
  return Object.keys(headers).some(k => k.toLowerCase() === 'authorization');
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
    let nextInit = init;
    if (token && !hasAuthorization(init?.headers)) {
      const base = init?.headers && typeof init.headers.forEach === 'function'
        ? Object.fromEntries((init.headers as any).entries?.() ?? [])
        : { ...(init?.headers || {}) };
      nextInit = { ...init, headers: { ...base, Authorization: `Bearer ${token}` } };
    }

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
      if (token && !hasAuthorization(config.headers)) {
        (config.headers as any) = { ...(config.headers as any), Authorization: `Bearer ${token}` };
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
