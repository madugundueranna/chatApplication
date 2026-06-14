import { useState } from "react";
import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { initials } from "../../lib/utils";

type AvatarProps = {
  uri?: string;
  name?: string;
  size?: number;
  online?: boolean;
  ring?: boolean; // gradient "story" ring
};

export function Avatar({
  uri,
  name = "",
  size = 48,
  online,
  ring,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!uri && !failed;
  const dot = Math.max(10, Math.round(size * 0.26));

  const inner = (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center overflow-hidden bg-muted"
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          className="font-semibold text-ink-secondary"
          style={{ fontSize: size * 0.38 }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ width: size, height: size }}>
      {ring ? (
        <LinearGradient
          colors={["#60A5FA", "#2563EB", "#1D4ED8"] as const}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            padding: 2.5,
          }}
        >
          <View
            className="flex-1 items-center justify-center rounded-full bg-white"
            style={{ padding: 2 }}
          >
            {inner}
          </View>
        </LinearGradient>
      ) : (
        inner
      )}

      {online ? (
        <View
          className="absolute rounded-full border-2 border-white bg-online"
          style={{
            width: dot,
            height: dot,
            right: 0,
            bottom: 0,
          }}
        />
      ) : null}
    </View>
  );
}
