import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type ScreenHeaderProps = {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  center?: ReactNode;
};

export function ScreenHeader({
  title,
  showBack = true,
  onBack,
  right,
  center,
}: ScreenHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View className="h-14 flex-row items-center justify-between px-2">
      <View className="min-w-[44px] flex-row items-center">
        {showBack ? (
          <Pressable
            onPress={handleBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" size={24} color="#0F172A" />
          </Pressable>
        ) : null}
      </View>

      <View className="flex-1 items-center">
        {center ?? (
          <Text className="text-lg font-semibold text-ink" numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      <View className="min-w-[44px] flex-row items-center justify-end">
        {right}
      </View>
    </View>
  );
}
