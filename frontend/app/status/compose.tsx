// Text-status composer: type a message, pick a background colour, post it as a
// text story (POST /api/status with { text, bgColor }).
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { statusApi } from "../../lib/api";

const COLORS = [
  "#2563EB",
  "#0F172A",
  "#DB2777",
  "#7C3AED",
  "#059669",
  "#EA580C",
  "#0891B2",
  "#DC2626",
];

export default function ComposeTextStatus() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [bg, setBg] = useState(COLORS[0]);
  const [posting, setPosting] = useState(false);

  const post = async () => {
    const t = text.trim();
    if (!t || posting) return;
    setPosting(true);
    try {
      await statusApi.createText(t, bg);
      router.back(); // chats screen re-fetches the tray on focus
    } catch (e: any) {
      Alert.alert("Couldn't post", e?.message ?? "Please try again.");
      setPosting(false);
    }
  };

  const canPost = Boolean(text.trim()) && !posting;

  return (
    <View className="flex-1" style={{ backgroundColor: bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <Pressable
            onPress={post}
            disabled={!canPost}
            className="flex-row items-center gap-1.5 rounded-full bg-white/20 px-4 py-2"
            style={{ opacity: canPost ? 1 : 0.5 }}
          >
            {posting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="send" size={16} color="#fff" />
            )}
            <Text className="font-semibold text-white">Post</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <View className="flex-1 items-center justify-center px-8">
            <TextInput
              value={text}
              onChangeText={setText}
              autoFocus
              multiline
              maxLength={280}
              placeholder="Type a status"
              placeholderTextColor="rgba(255,255,255,0.65)"
              className="w-full text-center text-2xl font-semibold leading-9 text-white"
            />
          </View>
        </KeyboardAvoidingView>

        {/* Background colour picker */}
        <View className="flex-row flex-wrap items-center justify-center gap-3 px-6 pb-4">
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setBg(c)}
              accessibilityLabel={`Background ${c}`}
              style={{ backgroundColor: c }}
              className={`h-9 w-9 rounded-full border-2 ${
                bg === c ? "border-white" : "border-white/30"
              }`}
            />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}
