import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
};

const map = {
  sm: { box: 30, icon: 17, text: "text-lg", radius: 10 },
  md: { box: 38, icon: 21, text: "text-xl", radius: 12 },
  lg: { box: 60, icon: 34, text: "text-3xl", radius: 18 },
} as const;

export function Logo({ size = "md", showWordmark = true }: LogoProps) {
  const s = map[size];
  return (
    <View className="flex-row items-center gap-2.5">
      <LinearGradient
        colors={["#60A5FA", "#2563EB", "#1D4ED8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#2563EB",
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={s.icon} color="#FFFFFF" />
      </LinearGradient>
      {showWordmark ? (
        <Text className={`font-bold ${s.text}`}>
          <Text className="text-ink">Chat</Text>
          <Text className="text-primary">loop</Text>
        </Text>
      ) : null}
    </View>
  );
}
