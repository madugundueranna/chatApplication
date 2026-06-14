import axios from 'axios';
import { API_URL } from '../lib/config';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearTokens,
} from '../lib/tokens';

const client = axios.create({ baseURL: API_URL });

// --- Request: attach the bearer token ---
client.interceptors.request.use((cfg) => {
  const token = getAccessToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Turn an axios error into a flat, predictable shape for the UI.
// The backend's 422 body is `{ success, message, data: [{ field, message }] }`.
const normalizeError = (error) => {
  const res = error.response;
  if (!res) {
    return { status: 0, message: 'Network error — is the backend running?' };
  }
  const body = res.data || {};

  // 422 bodies carry the real reason per-field in `data: [{ field, message }]`.
  const fieldList = Array.isArray(body.data) ? body.data.filter((e) => e?.field) : [];
  const fieldErrors = fieldList.length
    ? fieldList.reduce((acc, e) => ((acc[e.field] = e.message), acc), {})
    : undefined;

  // Surface what the API actually said: prefer the specific field message(s)
  // over the generic top-level "Validation failed", and tag the HTTP status so
  // a 422/404/500 is distinguishable in toasts and the table error row.
  const detail = fieldList.map((e) => `${e.field}: ${e.message}`).join('; ');
  const base = detail || body.message || 'Something went wrong';

  return {
    status: res.status,
    message: `${base} (${res.status})`,
    fieldErrors,
  };
};

const redirectToLogin = () => {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

// --- Refresh coordination: only one refresh in flight; queue the rest ---
let isRefreshing = false;
let waiters = [];

const resolveWaiters = (token) => {
  waiters.forEach((w) => w.resolve(token));
  waiters = [];
};
const rejectWaiters = (err) => {
  waiters.forEach((w) => w.reject(err));
  waiters = [];
};

// --- Response: unwrap the envelope, refresh once on 401 ---
client.interceptors.response.use(
  // Success: hand callers the inner `data` directly.
  (response) => response.data?.data,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Not an auth problem, or we've already retried this request once.
    if (status !== 401 || original._retry) {
      return Promise.reject(normalizeError(error));
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      redirectToLogin();
      return Promise.reject(normalizeError(error));
    }

    // A refresh is already running — wait for it, then replay this request.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push({ resolve, reject });
      }).then((token) => {
        original._retry = true;
        original.headers.Authorization = `Bearer ${token}`;
        return client(original);
      });
    }

    original._retry = true;
    isRefreshing = true;
    try {
      // Bare axios call so this request skips the interceptors above.
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const newToken = data?.data?.accessToken;
      if (!newToken) throw new Error('No access token in refresh response');

      setAccessToken(newToken);
      resolveWaiters(newToken);

      original.headers.Authorization = `Bearer ${newToken}`;
      return client(original);
    } catch (refreshErr) {
      rejectWaiters(refreshErr);
      clearTokens();
      redirectToLogin();
      return Promise.reject(normalizeError(refreshErr));
    } finally {
      isRefreshing = false;
    }
  }
);

export default client;
