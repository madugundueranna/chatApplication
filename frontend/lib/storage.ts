// Secure token storage.
//
// Native: Expo SecureStore (Keychain / Keystore). Web (react-native-web has no
// SecureStore): fall back to localStorage so the app still runs in a browser.
// Only the access/refresh JWTs live here — never passwords.

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "auth.accessToken";
const REFRESH_KEY = "auth.refreshToken";

const isWeb = Platform.OS === "web";

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, tokens.accessToken),
    setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function saveAccessToken(accessToken: string): Promise<void> {
  await setItem(ACCESS_KEY, accessToken);
}

export function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_KEY);
}

export function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_KEY);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
}
