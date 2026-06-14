// Session glue shared by the HTTP client, the socket service and the auth store.
//
// Lives in its own module (importing only storage/config/axios) so http.ts,
// socket.ts and auth.tsx can all use it without an import cycle. It owns three
// things:
//   1. the current user's readable id (USR-…), used by the id mappers;
//   2. a single-flight access-token refresh, shared by the axios 401 interceptor
//      and the socket reconnect-on-expiry path (so we never stampede /auth/refresh);
//   3. an onAuthFailure hook the AuthProvider wires to its logout().

import axios from "axios";
import { Platform } from "react-native";
import { API_URL } from "./config";
import {
  getRefreshToken,
  saveTokens,
  saveAccessToken,
  clearTokens,
} from "./storage";

const isWeb = Platform.OS === "web";

// ---- Current user id (for the readable-id -> _id mappers) -------------------

let currentUserId: string | null = null;

export function setCurrentUserId(id: string | null): void {
  currentUserId = id;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

// ---- Auth-failure hook ------------------------------------------------------

let onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

// Clear tokens + notify the app to route back to auth. Idempotent.
export async function forceLogout(): Promise<void> {
  setCurrentUserId(null);
  await clearTokens();
  onAuthFailure?.();
}

// ---- Single-flight access-token refresh -------------------------------------

let refreshInFlight: Promise<string> | null = null;

// A bare axios call (no interceptors) so a 401 here can't recurse into itself.
// Web: the refresh token rides in the HttpOnly cookie (withCredentials), and the
// server rotates it via Set-Cookie. Native: send the stored refresh token and
// persist the rotated pair the server returns.
async function requestNewAccessToken(): Promise<string> {
  const body: { refreshToken?: string } = {};
  if (!isWeb) {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new Error("No refresh token");
    body.refreshToken = refreshToken;
  }

  const res = await axios.post(`${API_URL}/auth/refresh`, body, {
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
  });
  const accessToken: string | undefined = res.data?.data?.accessToken;
  if (!accessToken) throw new Error("Refresh did not return an access token");

  if (!isWeb) {
    const rotated: string | undefined = res.data?.data?.refreshToken;
    if (rotated) await saveTokens({ accessToken, refreshToken: rotated });
    else await saveAccessToken(accessToken);
  }
  return accessToken;
}

// Returns the new access token. Concurrent callers share one in-flight request.
export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}
