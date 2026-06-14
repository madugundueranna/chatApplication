import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, SearchBar, SectionHeader } from "../../components/ui";
import { ChatListItem } from "../../components/chat";
import { conversationApi, userApi } from "../../lib/api";
import { ApiError } from "../../lib/http";
import { useCall } from "../../lib/call";
import { Conversation, User, CallType } from "../../lib/types";

const STORIES = [
  { id: "s1", label: "20 sec" },
  { id: "s2", label: "Yesterday" },
  { id: "s3", label: "Yesterday" },
  { id: "s4", label: "Last Week" },
];

export default function ContactDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const call = useCall();
  const [user, setUser] = useState<User | null>(null);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [u, convs, blockedList] = await Promise.all([
        userApi.getById(id),
        conversationApi.list(),
        userApi.blocked(),
      ]);
      if (!active) return;
      setUser(u);
      setRecent(
        convs.filter((c) => c.otherParticipants.some((p) => p._id === id))
      );
      setIsBlocked(blockedList.some((b) => b._id === id));
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const openChat = async () => {
    try {
      const conv = await conversationApi.createOrFetch({
        type: "direct",
        participantId: id,
      });
      router.replace(`/chat/${conv._id}`);
    } catch (e) {
      Alert.alert("Couldn't open chat", (e as ApiError).message);
    }
  };

  const startCall = async (type: CallType) => {
    if (!user) return;
    const callId = await call.startCall(
      { _id: user._id, name: user.name, avatar: user.avatar },
      type
    );
    if (callId) router.push(`/call/${callId}` as any);
  };

  const toggleBlock = async () => {
    const next = !isBlocked;
    setIsBlocked(next);
    try {
      await (next ? userApi.block(id) : userApi.unblock(id));
    } catch (e) {
      setIsBlocked(!next); // revert
      Alert.alert("Couldn't update", (e as ApiError).message);
    }
  };

  const onReport = () => {
    const submit = async (reason: string) => {
      try {
        await userApi.report(id, reason);
        Alert.alert("Report submitted", "Thanks — our team will review it.");
      } catch (e) {
        Alert.alert("Couldn't report", (e as ApiError).message);
      }
    };
    Alert.alert(`Report ${user?.name ?? "user"}`, "Why are you reporting this person?", [
      { text: "Spam", onPress: () => submit("Spam") },
      { text: "Harassment or bullying", onPress: () => submit("Harassment or bullying") },
      { text: "Inappropriate content", onPress: () => submit("Inappropriate content") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openMenu = () => {
    Alert.alert(user?.name ?? "Options", undefined, [
      {
        text: isBlocked ? "Unblock" : "Block",
        style: isBlocked ? "default" : "destructive",
        onPress: toggleBlock,
      },
      { text: "Report", onPress: onReport },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-2 px-3 py-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Go back"
          className="h-11 w-11 items-center justify-center rounded-full bg-muted"
        >
          <Ionicons name="chevron-back" size={22} color="#0F172A" />
        </Pressable>
        <View className="flex-1">
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search Chats" />
        </View>
        <Pressable
          onPress={openMenu}
          hitSlop={8}
          accessibilityLabel="More options"
          className="h-11 w-11 items-center justify-center rounded-full bg-muted"
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#0F172A" />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Hero */}
        <View className="items-center">
          <LinearGradient
            colors={["#DBEAFE", "#EFF6FF"] as const}
            style={{ height: 112, width: "100%" }}
          />
          <View className="-mt-14">
            <Avatar uri={user?.avatar} name={user?.name ?? ""} size={104} ring />
          </View>
          <View className="mt-3 flex-row items-center gap-1.5">
            <Text className="text-xl font-semibold text-ink">
              {user?.name ?? ""}
            </Text>
            {user?.isVerifiedAccount ? (
              <Ionicons name="checkmark-circle" size={18} color="#2563EB" />
            ) : null}
          </View>
          {isBlocked ? (
            <View className="mt-1 flex-row items-center gap-1 rounded-full bg-danger/10 px-3 py-1">
              <Ionicons name="ban-outline" size={13} color="#EF4444" />
              <Text className="text-xs font-medium text-danger">Blocked</Text>
            </View>
          ) : null}
          {user?.bio ? (
            <Text className="mt-1 px-10 text-center text-sm text-ink-secondary">
              {user.bio}
            </Text>
          ) : null}
        </View>

        {/* Info rows */}
        <View className="mt-5 gap-3 px-6">
          {user?.location ? (
            <View className="flex-row items-center gap-3">
              <Ionicons name="location-outline" size={18} color="#2563EB" />
              <Text className="text-sm text-ink-secondary">{user.location}</Text>
            </View>
          ) : null}
          {user?.phone ? (
            <View className="flex-row items-center gap-3">
              <Ionicons name="call-outline" size={18} color="#2563EB" />
              <Text className="text-sm text-ink-secondary">{user.phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        <View className="mt-5 flex-row gap-3 px-6">
          <View className="flex-1">
            <Button
              label="Audio"
              variant="primary"
              onPress={() => startCall("audio")}
              leftIcon={<Ionicons name="call" size={16} color="#FFFFFF" />}
              fullWidth
            />
          </View>
          <View className="flex-1">
            <Button
              label="Video"
              variant="primary"
              onPress={() => startCall("video")}
              leftIcon={<Ionicons name="videocam" size={16} color="#FFFFFF" />}
              fullWidth
            />
          </View>
        </View>

        {/* All Story */}
        <View className="mt-7 px-6">
          <SectionHeader title="All Story" onMore={() => {}} />
          <View className="mt-3 flex-row gap-4">
            {STORIES.map((s) => (
              <View key={s.id} className="items-center gap-1.5">
                <Avatar uri={user?.avatar} name={user?.name ?? ""} size={56} ring />
                <Text className="text-xs text-ink-secondary">{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Chats */}
        <View className="mt-7 px-6">
          <SectionHeader title="Recent Chats" onMore={() => {}} />
          <View className="mt-1">
            {recent.length ? (
              recent.map((c) => (
                <ChatListItem
                  key={c._id}
                  conversation={c}
                  onPress={() => router.replace(`/chat/${c._id}`)}
                />
              ))
            ) : (
              <Text className="py-3 text-sm text-ink-muted">
                No recent chats with {user?.name ?? "this contact"} yet.
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View className="absolute bottom-0 left-0 right-0 flex-row items-center gap-3 border-t border-border bg-white px-6 pb-7 pt-3">
        <View className="flex-1">
          <Button label="Chat Now" onPress={openChat} fullWidth size="lg" />
        </View>
        <Pressable
          accessibilityLabel="Share contact"
          className="w-14 items-center justify-center rounded-full bg-muted"
          style={{ height: 54 }}
        >
          <Ionicons name="share-social-outline" size={22} color="#2563EB" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
