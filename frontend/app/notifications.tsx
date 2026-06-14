import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, EmptyState, ScreenHeader } from "../components/ui";
import { notificationApi } from "../lib/api";
import { mapNotification } from "../lib/api/mappers";
import * as socket from "../lib/socket";
import { AppNotification, NotificationType } from "../lib/types";
import { formatRelativeShort } from "../lib/utils";

// Icon + tint per notification category (used when there's no sender avatar).
const ICONS: Record<NotificationType, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  message: { name: "chatbubble-ellipses", color: "#2563EB", bg: "bg-primary-50" },
  new_chat: { name: "person-add", color: "#2563EB", bg: "bg-primary-50" },
  group_added: { name: "people", color: "#7C3AED", bg: "bg-violet-100" },
  call_missed: { name: "call", color: "#EF4444", bg: "bg-red-100" },
  call_incoming: { name: "call", color: "#16A34A", bg: "bg-green-100" },
};

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  const icon = ICONS[item.type] ?? ICONS.message;
  return (
    <Pressable
      onPress={() => onPress(item)}
      className={`flex-row items-center gap-3 rounded-2xl px-3 py-3 ${
        item.isRead ? "" : "bg-primary-50"
      }`}
    >
      {item.sender ? (
        <Avatar uri={item.sender.avatar} name={item.sender.name} size={46} />
      ) : (
        <View className={`h-[46px] w-[46px] items-center justify-center rounded-full ${icon.bg}`}>
          <Ionicons name={icon.name} size={22} color={icon.color} />
        </View>
      )}

      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
          {item.title}
        </Text>
        {item.body ? (
          <Text className="mt-0.5 text-[13px] text-ink-secondary" numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
      </View>

      <View className="items-end gap-1.5">
        <Text className="text-[11px] text-ink-secondary">
          {formatRelativeShort(item.createdAt)}
        </Text>
        {item.isRead ? null : <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </View>
    </Pressable>
  );
}

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    const { items: data, nextCursor } = await notificationApi.list();
    setItems(data);
    setCursor(nextCursor);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live-prepend notifications that arrive while the screen is open.
  useEffect(() => {
    const off = socket.on(socket.EVT.NOTIFICATION_NEW, (payload: any) => {
      const n = mapNotification(payload?.notification ?? payload);
      if (!n._id) return;
      setItems((prev) => (prev.some((p) => p._id === n._id) ? prev : [n, ...prev]));
    });
    return off;
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onEndReached = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items: more, nextCursor } = await notificationApi.list({ cursor });
      setItems((prev) => [...prev, ...more]);
      setCursor(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationApi.markAllRead();
    } catch {
      /* optimistic — a failed call self-heals on next fetch */
    }
  }, []);

  const onPressItem = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) {
        setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
        notificationApi.markRead(n._id).catch(() => {});
      }
      const conversationId = n.data?.conversationId;
      if (conversationId) router.push(`/chat/${conversationId}`);
    },
    [router]
  );

  const hasUnread = items.some((n) => !n.isRead);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader
        title="Notifications"
        right={
          hasUnread ? (
            <Pressable onPress={markAllRead} hitSlop={8} className="px-2 py-1">
              <Text className="text-[13px] font-semibold text-primary">Mark all read</Text>
            </Pressable>
          ) : null
        }
      />

      <FlatList
        data={loading ? [] : items}
        keyExtractor={(n) => n._id}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReachedThreshold={0.4}
        onEndReached={onEndReached}
        renderItem={({ item }) => <NotificationRow item={item} onPress={onPressItem} />}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator className="py-4" color="#2563EB" /> : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator className="mt-16" color="#2563EB" />
          ) : (
            <EmptyState
              icon="notifications-outline"
              title="No notifications yet"
              message="Messages, calls and group updates will show up here."
            />
          )
        }
      />
    </SafeAreaView>
  );
}
