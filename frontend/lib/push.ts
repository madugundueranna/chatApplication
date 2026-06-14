// Expo push notifications.
//
// Registers the device for push, hands its Expo token to the backend, and exposes
// a tap handler for deep-linking. Remote push requires a development build (Expo Go
// no longer supports it on SDK 53+) and an EAS `projectId`; when either is missing
// — or we're on a simulator — every entry point no-ops gracefully so the rest of
// the app is unaffected.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { notificationApi } from "./api";

// Foreground display behaviour for an incoming push (SDK 56 handler shape).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ??
  (Constants as any)?.easConfig?.projectId;

// Register for push and send the Expo token to the backend. Returns the token, or
// null when push isn't available (simulator, Expo Go, missing projectId, denied).
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice || !projectId) {
    if (__DEV__ && !projectId)
      console.warn("[push] No EAS projectId in app config — skipping push registration.");
    return null;
  }

  try {
    if (Platform.OS === "android") {
      // On Android 13+ the channel must exist before requesting the token.
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2563EB",
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token && token !== registeredToken) {
      await notificationApi.registerPushToken(token);
      registeredToken = token;
    }
    return token;
  } catch (e) {
    if (__DEV__) console.warn("[push] registration failed:", e);
    return null;
  }
}

// Drop this device's token from the backend (call before logout clears the session).
export async function unregisterFromPush(): Promise<void> {
  if (!registeredToken) return;
  try {
    await notificationApi.removePushToken(registeredToken);
  } catch {
    /* best-effort */
  }
  registeredToken = null;
}

// Subscribe to taps on a delivered push; the handler gets the notification's
// `data` payload (e.g. { conversationId }). Returns an unsubscribe.
export function onNotificationTap(handler: (data: any) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response.notification.request.content.data ?? {});
  });
  return () => sub.remove();
}
