import { Text, View } from "react-native";

export function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <View className="min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5">
      <Text className="text-xs font-semibold text-white">
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}
