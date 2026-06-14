import { Pressable, Text } from "react-native";

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full px-4 py-2 ${
        active ? "bg-primary" : "bg-white border border-border"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          active ? "text-white" : "text-ink-secondary"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
