// Single axios instance used by every resource module.
//
// - Request interceptor attaches `Authorization: Bearer <access>` from storage.
// - Response interceptor: on a 401 for an authenticated request, refresh the
//   access token ONCE (shared, single-flight — see lib/session) and retry the
//   original request; if the refresh fails, force logout. Auth endpoints opt out
//   via `{ skipAuthRefresh: true }` so a bad login (also 401) never triggers it.
// - Errors are normalized to `ApiError { status, message, fieldErrors? }` so
//   screens get a consistent shape (and inline 422 field messages).

import axios, { AxiosError, AxiosResponse } from "axios";
import { Platform } from "react-native";
import { API_URL } from "./config";
import { getAccessToken } from "./storage";
import { refreshAccessToken, forceLogout } from "./session";

// Web authenticates via HttpOnly cookies (sent automatically with withCredentials);
// native sends the access token in the Authorization header.
const isWeb = Platform.OS === "web";

// Extra per-request flags. `skipAuthRefresh` opts auth endpoints out of the 401
// refresh-retry; `__isRetry` guards against retrying more than once.
declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
    __isRetry?: boolean;
  }
}

export class ApiError extends Error {
  status?: number;
  fieldErrors?: Record<string, string>;
  isNetworkError: boolean; // true when the request never reached the server

  constructor(
    message: string,
    status?: number,
    fieldErrors?: Record<string, string>,
    isNetworkError = false
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.isNetworkError = isNetworkError;
  }
}

export const http = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
  withCredentials: true, // send/receive the HttpOnly auth cookies on web
});

http.interceptors.request.use(async (config) => {
  // Web is authenticated by the cookie; only native attaches the header.
  if (!isWeb) {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Turn any axios failure into an ApiError with a human-friendly message.
// - No HTTP response  => transport failure (server down / wrong base URL / offline
//   / CORS / DNS). Axios reports these as a raw "Network Error" or a timeout; we
//   replace it with something the user can act on.
// - 5xx               => the server is reachable but erroring.
// - 422               => map the returned field names to inline errors. The backend
//   sends `data` as an array of field-name strings (we also tolerate {field,message}).
function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<any>;

    // Transport failure: no response came back.
    if (!err.response) {
      const timedOut = err.code === "ECONNABORTED" || /timeout/i.test(err.message);
      const message = timedOut
        ? "The request timed out. Check your connection and try again."
        : "Can't reach the server. Make sure the backend is running and the API URL is correct for your device.";
      return new ApiError(message, undefined, undefined, true);
    }

    const status = err.response.status;
    const body = err.response.data;

    if (status >= 500) {
      return new ApiError(
        body?.message || "The server ran into a problem. Please try again.",
        status
      );
    }

    const message: string = body?.message || `Request failed (${status}).`;

    let fieldErrors: Record<string, string> | undefined;
    if (status === 422 && Array.isArray(body?.data)) {
      fieldErrors = {};
      for (const entry of body.data) {
        if (typeof entry === "string") fieldErrors[entry] = message;
        else if (entry?.field) fieldErrors[entry.field] = entry.message || message;
      }
      // Prefer the first readable field message for the banner (e.g. screens that
      // don't render per-field errors), falling back to the generic message.
      const first = Object.values(fieldErrors)[0];
      return new ApiError(first || message, status, fieldErrors);
    }
    return new ApiError(message, status, fieldErrors);
  }
  return new ApiError("Something went wrong. Please try again.");
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config;
    const status = error.response?.status;

    // On a 401, refresh once and retry. Auth endpoints opt out via skipAuthRefresh
    // (a bad login is also 401). Works for both transports: web refreshes the
    // cookie server-side, native swaps the Authorization header.
    if (status === 401 && config && !config.skipAuthRefresh && !config.__isRetry) {
      config.__isRetry = true;
      try {
        const token = await refreshAccessToken();
        if (!isWeb) config.headers.Authorization = `Bearer ${token}`;
        return http(config);
      } catch {
        await forceLogout();
        return Promise.reject(normalizeError(error));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

// Pull `data` out of the { success, message, data } envelope.
export function unwrap<T>(res: AxiosResponse<{ data: T }>): T {
  return res.data.data;
}
