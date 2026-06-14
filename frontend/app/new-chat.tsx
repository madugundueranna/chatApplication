import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, EmptyState, ScreenHeader, SearchBar } from "../components/ui";
import { conversationApi, userApi } from "../lib/api";
import { ApiError } from "../lib/http";
import { PublicUser } from "../lib/types";

export default function NewChat() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query.trim();
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      // No "list all users" endpoint — fall back to recent contacts when idle.
      const data = q ? await userApi.search(q) : await userApi.recentContacts();
      if (active) {
        setResults(data);
        setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const startChat = async (user: PublicUser) => {
    try {
      const conv = await conversationApi.createOrFetch({
        type: "direct",
        participantId: user._id,
      });
      router.replace(`/chat/${conv._id}`);
    } catch (e) {
      Alert.alert("Couldn't start chat", (e as ApiError).message);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="New Chat" />

      <View className="px-4">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
        />
      </View>

      {/* New Group entry */}
      <Pressable
        onPress={() => router.push("/new-group")}
        className="mt-2 flex-row items-center gap-3 px-5 py-3.5"
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-primary">
          <Ionicons name="people" size={22} color="#FFFFFF" />
        </View>
        <Text className="flex-1 text-[15px] font-semibold text-ink">
          New Group
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
      </Pressable>

      <View className="mt-1 border-t border-border" />

      <FlatList
        data={results}
        keyExtractor={(u) => u._id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => startChat(item)}
            className="flex-row items-center gap-3 py-2.5"
          >
            <Avatar
              uri={item.avatar}
              name={item.name}
              size={46}
              online={item.isOnline}
            />
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-ink">
                {item.name}
              </Text>
              <Text className="text-xs text-ink-secondary">
                {item.isOnline ? "online" : "offline"}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="search-outline"
              title="No people found"
              message="Try a different name or email."
            />
          )
        }
      />
    </SafeAreaView>
  );
}
