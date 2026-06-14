import "../global.css";

import { useEffect } from "react";
import { Text as RNText, TextInput as RNTextInput } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "../lib/auth";
import { CallProvider } from "../lib/call";
import { CallOverlay } from "../components/call/CallOverlay";
import { onNotificationTap } from "../lib/push";

SplashScreen.preventAutoHideAsync();

// Make Inter the app-wide default font so any unstyled <Text> still looks right.
const defaultTextStyle = { fontFamily: "Inter_400Regular", color: "#0F172A" };
const TextAny = RNText as unknown as { defaultProps?: { style?: unknown } };
TextAny.defaultProps = TextAny.defaultProps || {};
TextAny.defaultProps.style = [defaultTextStyle];
const TextInputAny = RNTextInput as unknown as {
  defaultProps?: { style?: unknown };
};
TextInputAny.defaultProps = TextInputAny.defaultProps || {};
TextInputAny.defaultProps.style = [{ fontFamily: "Inter_400Regular" }];

// Renders the navigator and keeps routing in sync with the auth session.
function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Hide the splash once the session has resolved (logged in or not).
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync();
  }, [status]);

  // Global auth gate: bounce to auth on logout / forced logout; into the app once
  // authenticated. Per-screen login() already replaces to /(tabs); this catches
  // the runtime transitions (e.g. a failed token refresh deep in the http layer).
  useEffect(() => {
    if (status === "loading") return;
    const inAuth = segments[0] === "(auth)";
    if (status === "unauth" && !inAuth) router.replace("/(auth)/login");
    else if (status === "auth" && inAuth) router.replace("/(tabs)");
  }, [status, segments, router]);

  // Tapping a delivered push deep-links to the relevant chat (when authenticated).
  useEffect(() => {
    if (status !== "auth") return;
    return onNotificationTap((data) => {
      if (data?.conversationId) router.push(`/chat/${data.conversationId}`);
    });
  }, [status, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="contact/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen
        name="call/[id]"
        options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="status/[userId]"
        options={{
          presentation: "fullScreenModal",
          animation: "fade",
          contentStyle: { backgroundColor: "#000000" },
        }}
      />
      <Stack.Screen
        name="new-chat"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="new-group"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthProvider>
          <CallProvider>
            <RootNavigator />
            <CallOverlay />
          </CallProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
