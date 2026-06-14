import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type SectionHeaderProps = {
  title: string;
  onMore?: () => void;
  className?: string;
};

export function SectionHeader({ title, onMore, className }: SectionHeaderProps) {
  return (
    <View
      className={`flex-row items-center justify-between ${className ?? ""}`}
    >
      <Text className="text-base font-semibold text-ink">{title}</Text>
      {onMore ? (
        <Pressable
          onPress={onMore}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`More ${title}`}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#94A3B8" />
        </Pressable>
      ) : null}
    </View>
  );
}
