// Global incoming-call UI. Shown whenever a call is ringing (phase === "incoming"),
// regardless of which screen the user is on. Accept routes to the call screen.

import { Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../ui/Avatar";
import { useCall } from "../../lib/call";

export function IncomingCallModal() {
  const router = useRouter();
  const { phase, call, accept, reject } = useCall();

  const visible = phase === "incoming" && !!call;
  if (!call) return null;

  const onAccept = async () => {
    await accept();
    // Cast: /call/[id] is regenerated into expo-router's typed routes on start.
    router.replace(`/call/${call.callId}` as any);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View className="flex-1 items-center justify-between bg-ink px-8 py-16">
        <View className="items-center gap-4 pt-10">
          <Text className="text-base font-medium text-ink-muted">
            Incoming {call.type === "video" ? "video" : "voice"} call
          </Text>
          <Avatar uri={call.peer.avatar} name={call.peer.name} size={120} ring />
          <Text className="mt-2 text-2xl font-bold text-white">
            {call.peer.name}
          </Text>
        </View>

        <View className="w-full flex-row items-center justify-around">
          <View className="items-center gap-2">
            <Pressable
              onPress={reject}
              accessibilityLabel="Decline call"
              className="h-16 w-16 items-center justify-center rounded-full bg-danger"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
            <Text className="text-sm text-ink-muted">Decline</Text>
          </View>

          <View className="items-center gap-2">
            <Pressable
              onPress={onAccept}
              accessibilityLabel="Accept call"
              className="h-16 w-16 items-center justify-center rounded-full bg-online"
            >
              <Ionicons
                name={call.type === "video" ? "videocam" : "call"}
                size={28}
                color="#FFFFFF"
              />
            </Pressable>
            <Text className="text-sm text-ink-muted">Accept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
