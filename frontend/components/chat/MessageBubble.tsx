import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MessageType } from "../../lib/types";

type MessageBubbleProps = {
  isMine: boolean;
  type: MessageType;
  content: string;
  time: string;
  isRead?: boolean;
  senderName?: string; // shown above received bubbles in groups
  fileName?: string; // original name for file messages (falls back to the URL)
  onLongPress?: () => void;
};

export function MessageBubble({
  isMine,
  type,
  content,
  time,
  isRead,
  senderName,
  fileName,
  onLongPress,
}: MessageBubbleProps) {
  return (
    <View className={`mb-1.5 px-3 ${isMine ? "items-end" : "items-start"}`}>
      {senderName && !isMine ? (
        <Text className="mb-0.5 ml-2 text-xs font-medium text-primary">
          {senderName}
        </Text>
      ) : null}

      <Pressable
        onLongPress={onLongPress}
        delayLongPress={250}
        className={`max-w-[78%] ${
          type === "image" ? "" : "px-3.5 py-2.5"
        } ${
          isMine
            ? "rounded-2xl rounded-br-md bg-primary"
            : "rounded-2xl rounded-bl-md bg-muted"
        } ${type === "image" ? "overflow-hidden" : ""}`}
      >
        {type === "image" ? (
          <Image
            source={{ uri: content }}
            style={{ width: 220, height: 220 }}
            className="rounded-2xl"
          />
        ) : type === "file" ? (
          <View className="flex-row items-center gap-2.5 py-1">
            <View
              className={`h-9 w-9 items-center justify-center rounded-lg ${
                isMine ? "bg-white/20" : "bg-primary-100"
              }`}
            >
              <Ionicons
                name="document-text"
                size={18}
                color={isMine ? "#FFFFFF" : "#2563EB"}
              />
            </View>
            <Text
              className={`max-w-[150px] text-sm font-medium ${
                isMine ? "text-white" : "text-ink"
              }`}
              numberOfLines={1}
            >
              {fileName || content}
            </Text>
          </View>
        ) : (
          <Text
            className={`text-[15px] leading-5 ${
              isMine ? "text-white" : "text-ink"
            }`}
          >
            {content}
          </Text>
        )}
      </Pressable>

      <View className="mt-0.5 flex-row items-center gap-1 px-1">
        <Text className="text-[10px] text-ink-muted">{time}</Text>
        {isMine ? (
          <Ionicons
            name={isRead ? "checkmark-done" : "checkmark"}
            size={13}
            color={isRead ? "#2563EB" : "#94A3B8"}
          />
        ) : null}
      </View>
    </View>
  );
}
