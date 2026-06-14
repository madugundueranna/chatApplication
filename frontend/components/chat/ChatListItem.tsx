import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Conversation } from "../../lib/types";
import { useMyId } from "../../lib/auth";
import { formatTime, previewText } from "../../lib/utils";

type ChatListItemProps = {
  conversation: Conversation;
  onPress?: () => void;
  onLongPress?: () => void;
};

export function ChatListItem({
  conversation,
  onPress,
  onLongPress,
}: ChatListItemProps) {
  const myId = useMyId();
  const other = conversation.otherParticipants[0];
  const isGroup = conversation.type === "group";
  const title = isGroup ? conversation.name ?? "Group" : other?.name ?? "Unknown";
  const avatarUri = other?.avatar;
  const online = !isGroup && !!other?.isOnline;

  const last = conversation.lastMessage;
  const fromMe = last?.sender === myId;
  const preview = previewText(last);
  const previewLabel = fromMe ? `You: ${preview}` : preview;

  const showBadge = conversation.unreadCount > 0;
  const showReadTick = !showBadge && fromMe;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: "#F1F5F9" }}
      className="flex-row items-center gap-3 px-1 py-2.5"
    >
      <View>
        {isGroup ? (
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-100">
            <Ionicons name="people" size={22} color="#2563EB" />
          </View>
        ) : (
          <Avatar uri={avatarUri} name={title} size={48} online={online} />
        )}
        {conversation.isPinned ? (
          <View className="absolute -left-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-white">
            <Ionicons name="pin" size={11} color="#2563EB" />
          </View>
        ) : null}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-1">
          <Text className="shrink text-[15px] font-semibold text-ink" numberOfLines={1}>
            {title}
          </Text>
          {conversation.muted ? (
            <Ionicons name="notifications-off" size={13} color="#94A3B8" />
          ) : null}
        </View>
        <Text className="mt-0.5 text-sm text-ink-secondary" numberOfLines={1}>
          {previewLabel}
        </Text>
      </View>

      <View className="items-end gap-1.5">
        <Text className="text-xs text-ink-muted">
          {last ? formatTime(last.createdAt) : ""}
        </Text>
        {showBadge ? (
          <Badge count={conversation.unreadCount} />
        ) : showReadTick ? (
          <Ionicons name="checkmark-done" size={16} color="#2563EB" />
        ) : (
          conversation.isFavourite && (
            <Ionicons name="heart" size={14} color="#EF4444" />
          )
        )}
      </View>
    </Pressable>
  );
}
