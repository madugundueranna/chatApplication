import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  ViewStyle,
} from "react-native";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: ViewStyle;
};

const sizeMap: Record<Size, { padY: string; text: string; minH: number }> = {
  sm: { padY: "py-2 px-4", text: "text-sm", minH: 40 },
  md: { padY: "py-3 px-5", text: "text-base", minH: 48 },
  lg: { padY: "py-4 px-6", text: "text-base", minH: 54 },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  fullWidth,
  leftIcon,
  rightIcon,
  style,
}: ButtonProps) {
  const s = sizeMap[size];
  const isDisabled = disabled || loading;

  const container =
    variant === "primary"
      ? "bg-primary"
      : variant === "danger"
        ? "bg-danger"
        : variant === "outline"
          ? "bg-white border border-border"
          : "bg-transparent";

  const textColor =
    variant === "primary" || variant === "danger"
      ? "text-white"
      : variant === "outline"
        ? "text-ink"
        : "text-primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        { minHeight: s.minH, opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1 },
        style,
      ]}
      className={`flex-row items-center justify-center rounded-full ${s.padY} ${container} ${
        fullWidth ? "w-full" : ""
      } ${variant === "primary" ? "shadow-sm" : ""}`}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary" || variant === "danger" ? "#FFFFFF" : "#2563EB"
          }
        />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {leftIcon}
          <Text className={`font-semibold ${s.text} ${textColor}`}>{label}</Text>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}
