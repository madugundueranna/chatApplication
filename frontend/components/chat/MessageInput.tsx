import { useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";
import {
  pickCameraPhoto,
  pickDocument,
  pickImageFromLibrary,
} from "../../lib/media";
import type { PickedAsset } from "../../lib/api/status";

type MessageInputProps = {
  onSend: (text: string) => void;
  // Picks a file (PDF/image) and hands it to the screen to upload + send.
  onSendFile?: (asset: PickedAsset) => void;
  // Realtime typing hints (optional — the screen wires these to socket events).
  onTyping?: () => void;
  onStopTyping?: () => void;
};

export function MessageInput({
  onSend,
  onSendFile,
  onTyping,
  onStopTyping,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const hasText = text.trim().length > 0;
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = () => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    onStopTyping?.();
  };

  const handleChange = (value: string) => {
    setText(value);
    if (value.trim()) {
      onTyping?.();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(stopTyping, 2500);
    } else {
      stopTyping();
    }
  };

  // Emojis are plain text — append to the field and send via the normal text path.
  const onPickEmoji = (emoji: EmojiType) => {
    setText((t) => t + emoji.emoji);
    onTyping?.();
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    stopTyping();
  };

  // + button → choose a source, pick, then hand the asset to the screen to send.
  const openAttachmentMenu = () => {
    if (!onSendFile) return;
    const run = async (pick: () => Promise<PickedAsset | null>) => {
      let asset: PickedAsset | null = null;
      try {
        asset = await pick();
      } catch (e: any) {
        Alert.alert("Permission needed", e?.message ?? "Couldn't open the picker.");
        return;
      }
      if (asset) onSendFile(asset);
    };
    Alert.alert("Send attachment", undefined, [
      { text: "Photo Library", onPress: () => run(pickImageFromLibrary) },
      { text: "Take Photo", onPress: () => run(pickCameraPhoto) },
      { text: "Document (PDF)", onPress: () => run(pickDocument) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View className="flex-row items-end gap-2 border-t border-border bg-white px-3 pb-2 pt-2">
      <Pressable
        onPress={openAttachmentMenu}
        accessibilityRole="button"
        accessibilityLabel="Add attachment"
        className="h-11 w-11 items-center justify-center rounded-full"
      >
        <Ionicons name="add-circle-outline" size={26} color="#64748B" />
      </Pressable>

      <View className="min-h-[44px] flex-1 flex-row items-center gap-2 rounded-2xl bg-muted px-4 py-2">
        <TextInput
          value={text}
          onChangeText={handleChange}
          onBlur={stopTyping}
          placeholder="Message"
          placeholderTextColor="#94A3B8"
          multiline
          className="flex-1 text-[15px] text-ink"
          // outlineStyle removes the default web focus outline (RN Web only)
          style={{ maxHeight: 120, paddingVertical: 0, outlineStyle: "none" } as any}
        />
        <Pressable
          onPress={() => setEmojiOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Emoji"
        >
          <Ionicons name="happy-outline" size={22} color="#94A3B8" />
        </Pressable>
      </View>

      <Pressable
        onPress={send}
        disabled={!hasText}
        accessibilityRole="button"
        accessibilityLabel="Send message"
        className={`h-11 w-11 items-center justify-center rounded-full ${
          hasText ? "bg-primary" : "bg-muted"
        }`}
      >
        <Ionicons
          name="send"
          size={19}
          color={hasText ? "#FFFFFF" : "#94A3B8"}
        />
      </Pressable>

      <EmojiPicker
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onEmojiSelected={onPickEmoji}
        // Keep the sheet open so several emoji can be added in a row.
        enableSearchBar
      />
    </View>
  );
}
