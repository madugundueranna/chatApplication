// Active / outgoing call screen. Driven entirely by the CallProvider state.
// Video shows the remote stream full-screen with a local PIP; audio shows the
// peer's avatar. When the call ends and state returns to idle, we pop back.

import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../components/ui";
import { useCall } from "../../lib/call";

// Native-only view for rendering a MediaStream (guarded so the web bundle is fine).
let RTCView: any = () => null;
if (Platform.OS !== "web") {
  RTCView = require("react-native-webrtc").RTCView;
}

function phaseLabel(phase: string, reason: string | null, seconds: number): string {
  switch (phase) {
    case "outgoing":
      return "Calling…";
    case "connecting":
      return "Connecting…";
    case "active": {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    case "ended":
      return reason ? `Call ended · ${reason}` : "Call ended";
    default:
      return "";
  }
}

function RoundButton({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <View className="items-center gap-2">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: danger ? "#EF4444" : active ? "#FFFFFF" : "rgba(255,255,255,0.18)",
        }}
      >
        <Ionicons
          name={icon}
          size={24}
          color={danger ? "#FFFFFF" : active ? "#0F172A" : "#FFFFFF"}
          style={icon === "call" && danger ? { transform: [{ rotate: "135deg" }] } : undefined}
        />
      </Pressable>
      <Text className="text-xs text-ink-muted">{label}</Text>
    </View>
  );
}

export default function CallScreen() {
  const router = useRouter();
  const {
    phase,
    call,
    localStream,
    remoteStream,
    muted,
    speaker,
    endedReason,
    end,
    toggleMute,
    toggleSpeaker,
  } = useCall();

  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);

  // Pop back once the call returns to idle (after teardown).
  useEffect(() => {
    if (phase === "idle") router.back();
  }, [phase, router]);

  // Talk-time counter.
  useEffect(() => {
    if (phase === "active") {
      if (startedAt.current == null) startedAt.current = Date.now();
      const t = setInterval(() => {
        if (startedAt.current != null) {
          setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(t);
    }
  }, [phase]);

  const isVideo = call?.type === "video";
  const showRemoteVideo = isVideo && remoteStream && phase === "active";

  return (
    <SafeAreaView className="flex-1 bg-ink">
      {/* Remote video fills the screen; audio falls back to the avatar block. */}
      {showRemoteVideo ? (
        <RTCView
          streamURL={(remoteStream as any).toURL()}
          objectFit="cover"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      {/* Local PIP for video calls. */}
      {isVideo && localStream ? (
        <View className="absolute right-4 top-16 h-40 w-28 overflow-hidden rounded-2xl border border-white/20">
          <RTCView
            streamURL={(localStream as any).toURL()}
            objectFit="cover"
            mirror
            zOrder={1}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      <View className="flex-1 items-center justify-between px-8 py-10">
        {/* Identity + status */}
        <View className="items-center gap-3 pt-8">
          {!showRemoteVideo ? (
            <Avatar uri={call?.peer.avatar} name={call?.peer.name ?? ""} size={120} ring />
          ) : null}
          <Text className="mt-2 text-2xl font-bold text-white">
            {call?.peer.name ?? "Call"}
          </Text>
          <Text className="text-base text-ink-muted">
            {phaseLabel(phase, endedReason, seconds)}
          </Text>
        </View>

        {/* Controls */}
        <View className="w-full flex-row items-center justify-center gap-6">
          <RoundButton
            icon={muted ? "mic-off" : "mic"}
            label={muted ? "Unmute" : "Mute"}
            onPress={toggleMute}
            active={muted}
          />
          <RoundButton
            icon="call"
            label="End"
            onPress={end}
            danger
          />
          <RoundButton
            icon={speaker ? "volume-high" : "volume-medium"}
            label="Speaker"
            onPress={toggleSpeaker}
            active={speaker}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
