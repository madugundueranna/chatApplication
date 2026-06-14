import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isHome = pathname === "/" || pathname === "/index";
  const isProfile = pathname.startsWith("/profile");

  return (
    <View
      className="flex-row items-center border-t border-border bg-white px-8"
      style={{ paddingBottom: insets.bottom + 6, paddingTop: 8 }}
    >
      <Pressable
        onPress={() => router.navigate("/(tabs)")}
        accessibilityRole="button"
        accessibilityLabel="Chats"
        className="flex-1 items-center gap-0.5"
      >
        <Ionicons
          name={isHome ? "home" : "home-outline"}
          size={24}
          color={isHome ? "#2563EB" : "#94A3B8"}
        />
        <Text
          className={`text-[11px] ${
            isHome ? "font-semibold text-primary" : "text-ink-muted"
          }`}
        >
          Home
        </Text>
      </Pressable>

      <View className="flex-1 items-center">
        <Pressable
          onPress={() => router.push("/new-chat")}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          className="-mt-7 flex-row items-center gap-1.5 rounded-full bg-primary px-5 py-3.5 shadow-md"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text className="text-sm font-semibold text-white">New Chat</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.navigate("/(tabs)/profile")}
        accessibilityRole="button"
        accessibilityLabel="Profile"
        className="flex-1 items-center gap-0.5"
      >
        <Ionicons
          name={isProfile ? "person" : "person-outline"}
          size={24}
          color={isProfile ? "#2563EB" : "#94A3B8"}
        />
        <Text
          className={`text-[11px] ${
            isProfile ? "font-semibold text-primary" : "text-ink-muted"
          }`}
        >
          Profile
        </Text>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
