import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type SearchBarProps = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
  autoFocus,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={`flex-row items-center gap-2 rounded-2xl border px-4 py-3 ${
        focused ? "border-primary bg-white" : "border-transparent bg-muted"
      }`}
    >
      <Ionicons
        name="search"
        size={18}
        color={focused ? "#2563EB" : "#94A3B8"}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoFocus={autoFocus}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 text-base text-ink"
        // outlineStyle removes the default web focus outline (RN Web only)
        style={{ paddingVertical: 0, outlineStyle: "none" } as any}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color="#94A3B8" />
        </Pressable>
      ) : null}
    </View>
  );
}
