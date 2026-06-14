import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button } from "../../components/ui";
import { useAuth } from "../../lib/auth";

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  danger?: boolean;
  onPress?: () => void;
};

function SettingsGroup({ rows }: { rows: Row[] }) {
  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-white">
      {rows.map((r, i) => (
        <Pressable
          key={r.label}
          onPress={r.onPress}
          android_ripple={{ color: "#F1F5F9" }}
          className={`flex-row items-center gap-3 px-4 py-3.5 ${
            i < rows.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: r.danger ? "#FEE2E2" : "#EFF6FF" }}
          >
            <Ionicons
              name={r.icon}
              size={18}
              color={r.danger ? "#EF4444" : (r.tint ?? "#2563EB")}
            />
          </View>
          <Text
            className={`flex-1 text-[15px] font-medium ${
              r.danger ? "text-danger" : "text-ink"
            }`}
          >
            {r.label}
          </Text>
          {!r.danger ? (
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { currentUser: me, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        <Text className="text-2xl font-bold text-ink">Profile</Text>

        {/* Header card */}
        <View className="mt-5 flex-row items-center gap-4 rounded-3xl bg-primary-50 p-4">
          <Avatar uri={me?.avatar} name={me?.name ?? ""} size={64} ring />
          <View className="flex-1">
            <Text className="text-lg font-semibold text-ink">
              {me?.name ?? ""}
            </Text>
            <Text className="text-sm text-ink-secondary">{me?.email ?? ""}</Text>
          </View>
        </View>

        <View className="mt-4">
          <Button
            label="Edit profile"
            variant="outline"
            onPress={() => router.push("/edit-profile")}
            leftIcon={<Ionicons name="create-outline" size={18} color="#0F172A" />}
            fullWidth
          />
        </View>

        {/* Settings */}
        <Text className="mb-2 mt-7 ml-1 text-sm font-semibold text-ink-secondary">
          Settings
        </Text>
        <SettingsGroup
          rows={[
            { icon: "person-outline", label: "Account" },
            { icon: "notifications-outline", label: "Notifications" },
            { icon: "lock-closed-outline", label: "Privacy" },
            { icon: "color-palette-outline", label: "Appearance" },
            { icon: "help-circle-outline", label: "Help & Support" },
          ]}
        />

        <View className="mt-4">
          <SettingsGroup
            rows={[
              {
                icon: "log-out-outline",
                label: "Log out",
                danger: true,
                onPress: onLogout,
              },
            ]}
          />
        </View>

        <Text className="mt-6 text-center text-xs text-ink-muted">
          Chatloop · v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
