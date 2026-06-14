import { useState } from "react";
import {
  KeyboardTypeOptions,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean; // enables password show/hide eye toggle
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoFocus?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  error?: string; // inline validation message (e.g. a 422 field error)
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  keyboardType,
  autoCapitalize = "none",
  autoFocus,
  leftIcon,
  error,
}: TextFieldProps) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="ml-1 text-sm font-medium text-ink-secondary">
          {label}
        </Text>
      ) : null}
      <View
        className={`h-14 flex-row items-center gap-2 rounded-2xl border px-4 ${
          error
            ? "border-danger bg-white"
            : focused
              ? "border-primary bg-primary-50"
              : "border-border bg-muted"
        }`}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={focused ? "#2563EB" : "#94A3B8"}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="flex-1 text-base text-ink"
          // outlineStyle removes the default web focus outline (RN Web only)
          style={{ paddingVertical: 0, outlineStyle: "none" } as any}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={20}
              color="#94A3B8"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="ml-1 text-xs font-medium text-danger">{error}</Text>
      ) : null}
    </View>
  );
}
