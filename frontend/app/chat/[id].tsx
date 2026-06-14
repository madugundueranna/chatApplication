import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Avatar } from "../../components/ui";
import {
  MessageBubble,
  MessageContextMenu,
  MessageInput,
  TypingIndicator,
} from "../../components/chat";
import { conversationApi, messageApi } from "../../lib/api";
import { ApiError } from "../../lib/http";
import { mapMessage } from "../../lib/api/mappers";
import * as socket from "../../lib/socket";
import { useMyId } from "../../lib/auth";
import { useCall } from "../../lib/call";
import { Conversation, Message, CallType } from "../../lib/types";
import { formatDayLabel, formatTime } from "../../lib/utils";

type Row =
  | { kind: "msg"; msg: Message }
  | { kind: "sep"; id: string; label: string };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const myId = useMyId();
  const call = useCall();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // newest first
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState(false);
  const [menuMsg, setMenuMsg] = useState<Message | null>(null);
  const [muted, setMuted] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [conv, page] = await Promise.all([
        conversationApi.getById(id),
        messageApi.history(id, { limit: 20 }),
      ]);
      if (!active) return;
      setConversation(conv);
      setMuted(Boolean(conv.muted));
      setMessages(page.items);
      setCursor(page.nextCursor);
      setLoading(false);
      messageApi.markConversationRead(id).catch(() => {});
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Live updates for this conversation.
  useEffect(() => {
    const offNew = socket.on(socket.EVT.MESSAGE_NEW, (raw: any) => {
      if (raw?.conversationId !== id) return;
      const msg = mapMessage(raw);
      setMessages((prev) =>
        prev.some((m) => m._id === msg._id) ? prev : [msg, ...prev]
      );
      // We're looking at the thread — keep it marked read.
      messageApi.markConversationRead(id).catch(() => {});
    });

    const offRead = socket.on(socket.EVT.MESSAGE_READ, (data: any) => {
      if (data?.conversationId !== id || !data?.userId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId && !m.readBy.includes(data.userId)
            ? { ...m, readBy: [...m.readBy, data.userId] }
            : m
        )
      );
    });

    const offTypingStart = socket.on(socket.EVT.TYPING_START, (data: any) => {
      if (data?.conversationId !== id || data?.userId === myId) return;
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 4000);
    });
    const offTypingStop = socket.on(socket.EVT.TYPING_STOP, (data: any) => {
      if (data?.conversationId !== id) return;
      setTyping(false);
    });

    const offStatus = socket.on(socket.EVT.USER_STATUS, (data: any) => {
      if (!data?.userId) return;
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              otherParticipants: prev.otherParticipants.map((p) =>
                p._id === data.userId
                  ? { ...p, isOnline: Boolean(data.isOnline) }
                  : p
              ),
            }
          : prev
      );
    });

    return () => {
      offNew();
      offRead();
      offTypingStart();
      offTypingStop();
      offStatus();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [id, myId]);

  const isGroup = conversation?.type === "group";
  const other = conversation?.otherParticipants[0];
  const senderNames = useMemo(() => {
    const map = new Map<string, string>();
    conversation?.otherParticipants.forEach((p) => map.set(p._id, p.name));
    return map;
  }, [conversation]);

  const title = isGroup
    ? conversation?.name ?? "Group"
    : other?.name ?? "Chat";
  const presence = isGroup
    ? `${conversation?.participants.length ?? 0} members`
    : typing
      ? "typing…"
      : other?.isOnline
        ? "online"
        : "last seen recently";

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      out.push({ kind: "msg", msg: m });
      const older = messages[i + 1];
      const boundary =
        !older ||
        formatDayLabel(older.createdAt) !== formatDayLabel(m.createdAt);
      if (boundary) {
        out.push({
          kind: "sep",
          id: `sep_${m._id}`,
          label: formatDayLabel(m.createdAt),
        });
      }
    }
    return out;
  }, [messages]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await messageApi.history(id, { cursor, limit: 20 });
      setMessages((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, id, loadingMore]);

  // Optimistic send: show immediately, reconcile with the socket ack (which
  // returns the saved message with its real id/timestamp). Falls back to REST.
  const onSend = useCallback(
    async (text: string) => {
      const tempId = `temp_${Date.now()}`;
      const now = new Date().toISOString();
      const optimistic: Message = {
        _id: tempId,
        conversation: id,
        sender: myId ?? "",
        content: text,
        type: "text",
        readBy: myId ? [myId] : [],
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      setMessages((prev) => [optimistic, ...prev]);

      const reconcile = (saved: Message) =>
        setMessages((prev) => prev.map((m) => (m._id === tempId ? saved : m)));

      try {
        const ack = await socket.emitWithAck<{
          success: boolean;
          message?: any;
          error?: string;
        }>(socket.EVT.MESSAGE_SEND, { conversationId: id, content: text });
        if (ack?.success && ack.message) {
          reconcile(mapMessage(ack.message));
          return;
        }
        throw new Error(ack?.error || "send failed");
      } catch (sockErr) {
        // Socket unavailable or errored — fall back to the REST endpoint.
        try {
          reconcile(await messageApi.send(id, text));
        } catch (restErr) {
          setMessages((prev) => prev.filter((m) => m._id !== tempId));
          // Surface the real reason (e.g. "You cannot message this user" when blocked).
          const message =
            (restErr as ApiError)?.message ||
            (sockErr as Error)?.message ||
            "Could not send your message.";
          Alert.alert("Message failed", message);
        }
      }
    },
    [id, myId]
  );

  const onCopy = async () => {
    if (menuMsg) await Clipboard.setStringAsync(menuMsg.content);
  };

  const onDeleteMessage = async (scope: "me" | "everyone") => {
    if (!menuMsg) return;
    const target = menuMsg;
    setMessages((prev) => prev.filter((m) => m._id !== target._id));
    try {
      await messageApi.remove(target._id, scope);
    } catch (e) {
      // Restore on failure (e.g. "too late to delete for everyone").
      setMessages((prev) =>
        [...prev, target].sort(
          (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
        )
      );
      Alert.alert("Delete failed", (e as ApiError).message);
    }
  };

  const onClearChat = () => {
    Alert.alert(
      "Clear chat",
      "Hide all messages in this chat for you? Other people keep their copy.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await conversationApi.clear(id);
              setMessages([]);
              setCursor(null);
            } catch (e) {
              Alert.alert("Couldn't clear", (e as ApiError).message);
            }
          },
        },
      ]
    );
  };

  const onToggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try {
      await (next ? conversationApi.mute(id) : conversationApi.unmute(id));
    } catch (e) {
      setMuted(!next); // revert
      Alert.alert("Couldn't update", (e as ApiError).message);
    }
  };

  const openConversationMenu = () => {
    if (!conversation) return;
    const buttons: any[] = [];
    if (!isGroup && other)
      buttons.push({ text: "View contact", onPress: () => router.push(`/contact/${other._id}`) });
    buttons.push({ text: "Clear chat", onPress: onClearChat });
    buttons.push({ text: muted ? "Unmute notifications" : "Mute notifications", onPress: onToggleMute });
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert(title, undefined, buttons);
  };

  const startCall = useCallback(
    async (type: CallType) => {
      if (!other || isGroup) return;
      const callId = await call.startCall(other, type, id);
      // Cast: the /call/[id] route is added by us; expo-router regenerates its
      // typed-route union on the next `expo start`.
      if (callId) router.push(`/call/${callId}` as any);
    },
    [other, isGroup, call, id, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === "sep") {
        return (
          <View className="my-3 items-center">
            <View className="rounded-full bg-muted px-3 py-1">
              <Text className="text-xs font-medium text-ink-secondary">
                {item.label}
              </Text>
            </View>
          </View>
        );
      }
      const m = item.msg;
      const isMine = m.sender === myId;
      const isRead = m.readBy.some((u) => u !== myId);
      return (
        <MessageBubble
          isMine={isMine}
          type={m.type}
          content={m.content}
          time={formatTime(m.createdAt)}
          isRead={isRead}
          senderName={isGroup && !isMine ? senderNames.get(m.sender) : undefined}
          onLongPress={() => setMenuMsg(m)}
        />
      );
    },
    [isGroup, senderNames, myId]
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="h-14 flex-row items-center border-b border-border px-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>

        <Pressable
          onPress={() => other && router.push(`/contact/${other._id}`)}
          className="flex-1 flex-row items-center gap-2.5"
        >
          {isGroup ? (
            <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-100">
              <Ionicons name="people" size={18} color="#2563EB" />
            </View>
          ) : (
            <Avatar uri={other?.avatar} name={title} size={36} online={other?.isOnline} />
          )}
          <View>
            <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-xs text-ink-secondary">{presence}</Text>
          </View>
        </Pressable>

        <View className="flex-row items-center">
          <Pressable
            onPress={() => startCall("audio")}
            disabled={isGroup}
            hitSlop={6}
            accessibilityLabel="Audio call"
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="call-outline" size={21} color={isGroup ? "#94A3B8" : "#2563EB"} />
          </Pressable>
          <Pressable
            onPress={() => startCall("video")}
            disabled={isGroup}
            hitSlop={6}
            accessibilityLabel="Video call"
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="videocam-outline" size={23} color={isGroup ? "#94A3B8" : "#2563EB"} />
          </Pressable>
          <Pressable
            onPress={openConversationMenu}
            hitSlop={6}
            accessibilityLabel="More options"
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#0F172A" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : (
          <FlatList
            data={rows}
            inverted
            keyExtractor={(item) => (item.kind === "sep" ? item.id : item.msg._id)}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12 }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={typing ? <TypingIndicator /> : null}
            ListFooterComponent={
              loadingMore ? (
                <View className="py-3">
                  <ActivityIndicator color="#94A3B8" />
                </View>
              ) : null
            }
          />
        )}

        <MessageInput
          onSend={onSend}
          onTyping={() => socket.emit(socket.EVT.TYPING_START, { conversationId: id })}
          onStopTyping={() => socket.emit(socket.EVT.TYPING_STOP, { conversationId: id })}
        />
      </KeyboardAvoidingView>

      <MessageContextMenu
        visible={!!menuMsg}
        onClose={() => setMenuMsg(null)}
        canDeleteForEveryone={menuMsg?.sender === myId}
        onCopy={onCopy}
        onDeleteForMe={() => onDeleteMessage("me")}
        onDeleteForEveryone={() => onDeleteMessage("everyone")}
      />
    </SafeAreaView>
  );
}
