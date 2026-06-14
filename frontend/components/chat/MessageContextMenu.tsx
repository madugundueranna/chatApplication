import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type MessageContextMenuProps = {
  visible: boolean;
  onClose: () => void;
  onCopy?: () => void;
  onForward?: () => void;
  onDeleteForMe?: () => void;
  onDeleteForEveryone?: () => void;
  // "Delete for everyone" is only offered to the sender (the backend also enforces
  // a time window and rejects late attempts).
  canDeleteForEveryone?: boolean;
};

type Row = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  danger?: boolean;
  hidden?: boolean;
};

export function MessageContextMenu({
  visible,
  onClose,
  onCopy,
  onForward,
  onDeleteForMe,
  onDeleteForEveryone,
  canDeleteForEveryone = false,
}: MessageContextMenuProps) {
  const rows: Row[] = [
    { label: "Forward", icon: "arrow-redo-outline", onPress: onForward, hidden: !onForward },
    { label: "Copy", icon: "copy-outline", onPress: onCopy },
    { label: "Delete for me", icon: "trash-outline", onPress: onDeleteForMe, danger: true },
    {
      label: "Delete for everyone",
      icon: "trash-bin-outline",
      onPress: onDeleteForEveryone,
      danger: true,
      hidden: !canDeleteForEveryone,
    },
  ];

  const handle = (fn?: () => void) => () => {
    onClose();
    fn?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/30 px-10"
        onPress={onClose}
      >
        <View className="w-64 overflow-hidden rounded-2xl bg-white py-1 shadow-md">
          {rows
            .filter((r) => !r.hidden)
            .map((r, i, arr) => (
              <Pressable
                key={r.label}
                onPress={handle(r.onPress)}
                android_ripple={{ color: "#F1F5F9" }}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  i < arr.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <Text
                  className={`text-[15px] font-medium ${
                    r.danger ? "text-danger" : "text-ink"
                  }`}
                >
                  {r.label}
                </Text>
                <Ionicons
                  name={r.icon}
                  size={18}
                  color={r.danger ? "#EF4444" : "#64748B"}
                />
              </Pressable>
            ))}
        </View>
      </Pressable>
    </Modal>
  );
}
