import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
};

export function EmptyState({
  icon = "chatbubbles-outline",
  title,
  message,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-10 py-16">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary-50">
        <Ionicons name={icon} size={36} color="#60A5FA" />
      </View>
      <Text className="text-center text-base font-semibold text-ink">
        {title}
      </Text>
      {message ? (
        <Text className="mt-1 text-center text-sm text-ink-secondary">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
