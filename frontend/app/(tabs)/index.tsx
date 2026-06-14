import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Chip,
  EmptyState,
  Logo,
  SearchBar,
  SectionHeader,
} from "../../components/ui";
import { ChatListItem, StoryList } from "../../components/chat";
import { conversationApi, notificationApi, statusApi } from "../../lib/api";
import * as socket from "../../lib/socket";
import { useAuth } from "../../lib/auth";
import { Conversation, StatusGroup } from "../../lib/types";
import { pickStatusMedia } from "../../lib/media";

type FilterKey = "all" | "unread" | "favourite" | "group";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread Chats" },
  { key: "favourite", label: "Favourite Chats" },
  { key: "group", label: "Group" },
];

function SkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 px-1 py-3">
      <View className="h-12 w-12 rounded-full bg-muted" />
      <View className="flex-1 gap-2">
        <View className="h-3.5 w-1/2 rounded-full bg-muted" />
        <View className="h-3 w-3/4 rounded-full bg-muted" />
      </View>
    </View>
  );
}

export default function ChatsHome() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [unread, setUnread] = useState(0);
  const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await conversationApi.list();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      setUnread(await notificationApi.unreadCount());
    } catch {
      /* badge is best-effort; leave the last known count */
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setStatusGroups(await statusApi.feed());
    } catch {
      /* the stories row is best-effort */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadUnread();
      loadStatus();
    }, [load, loadUnread, loadStatus])
  );

  // Pick a photo/video and post it as a status.
  const postMediaStory = useCallback(async () => {
    let media;
    try {
      media = await pickStatusMedia();
    } catch (e: any) {
      Alert.alert("Permission needed", e?.message ?? "Couldn't open the picker.");
      return;
    }
    if (!media) return;
    try {
      setUploading(true);
      await statusApi.create(media);
      await loadStatus();
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Could not post your status.");
    } finally {
      setUploading(false);
    }
  }, [loadStatus]);

  // Choose a photo/video or a text card.
  const onAddStory = useCallback(() => {
    Alert.alert("Add to your story", undefined, [
      { text: "Photo or Video", onPress: postMediaStory },
      { text: "Text", onPress: () => router.push("/status/compose" as any) },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [postMediaStory, router]);

  // Keep the list live: any new/read message changes last-message, order or unread.
  useEffect(() => {
    const offNew = socket.on(socket.EVT.MESSAGE_NEW, load);
    const offRead = socket.on(socket.EVT.MESSAGE_READ, load);
    // The bell badge tracks the unread count the server sends with each notification.
    const offNotif = socket.on(socket.EVT.NOTIFICATION_NEW, (payload: any) => {
      if (typeof payload?.unreadCount === "number") setUnread(payload.unreadCount);
      else setUnread((n) => n + 1);
    });
    // A contact posted a story → refresh the stories tray.
    const offStory = socket.on(socket.EVT.STORY_NEW, () => loadStatus());
    return () => {
      offNew();
      offRead();
      offNotif();
      offStory();
    };
  }, [load, loadStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      const title =
        c.type === "group" ? c.name ?? "" : c.otherParticipants[0]?.name ?? "";
      const matchesQuery = !q || title.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "unread"
            ? c.unreadCount > 0
            : filter === "favourite"
              ? !!c.isFavourite
              : c.type === "group";
      return matchesQuery && matchesFilter;
    });
  }, [items, filter, query]);

  const sections = useMemo(() => {
    const pinned = filtered.filter((c) => c.isPinned);
    const rest = filtered.filter((c) => !c.isPinned);
    const out: { title: string; data: Conversation[] }[] = [];
    if (pinned.length) out.push({ title: "Pinned Chats", data: pinned });
    out.push({ title: "All Chats", data: rest });
    return out;
  }, [filtered]);

  const onLongPressChat = (c: Conversation) => {
    const title =
      c.type === "group" ? c.name ?? "Chat" : c.otherParticipants[0]?.name ?? "Chat";
    Alert.alert(title, undefined, [
      { text: "Pin", onPress: () => {} },
      {
        text: "Mute notifications",
        onPress: async () => {
          try {
            await conversationApi.mute(c._id);
          } catch {
            /* best-effort */
          }
        },
      },
      {
        text: "Clear chat",
        onPress: () =>
          Alert.alert("Clear chat", "Hide all messages in this chat for you?", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Clear",
              style: "destructive",
              onPress: async () => {
                try {
                  await conversationApi.clear(c._id);
                  load();
                } catch {
                  /* best-effort */
                }
              },
            },
          ]),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await conversationApi.remove(c._id);
          load();
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Top bar */}
      <View className="h-14 flex-row items-center justify-between px-5">
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push("/notifications")}
          className="h-11 w-11 items-center justify-center"
        >
          <View>
            <Ionicons name="notifications-outline" size={24} color="#0F172A" />
            {unread > 0 ? (
              <View className="absolute -right-1.5 -top-1 h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-primary px-1">
                <Text className="text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>

      <SectionList
        sections={loading ? [] : sections}
        keyExtractor={(item) => item._id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
        }
        ListHeaderComponent={
          <View>
            {/* Stories card */}
            <View className="mt-1 rounded-3xl bg-primary-100 p-4">
              <StoryList
                groups={statusGroups}
                myName={currentUser?.name ?? "You"}
                myAvatar={currentUser?.avatar}
                uploading={uploading}
                onAddStory={onAddStory}
                onPressGroup={(userId) => router.push(`/status/${userId}` as Href)}
              />
              <View className="mt-4">
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Select or search recent chats"
                />
              </View>
            </View>

            {/* Filter chips */}
            <View className="mt-4 flex-row flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  label={f.label}
                  active={filter === f.key}
                  onPress={() => setFilter(f.key)}
                />
              ))}
            </View>

            {loading ? (
              <View className="mt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.data.length ? (
            <SectionHeader
              title={section.title}
              onMore={() => {}}
              className="mt-5 mb-1"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ChatListItem
            conversation={item}
            onPress={() => router.push(`/chat/${item._id}`)}
            onLongPress={() => onLongPressChat(item)}
          />
        )}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No chats yet"
              message="Start a new conversation to see it here."
            />
          )
        }
      />
    </SafeAreaView>
  );
}
