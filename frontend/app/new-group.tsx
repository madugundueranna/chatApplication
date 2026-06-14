import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  Button,
  EmptyState,
  FormError,
  ScreenHeader,
  SearchBar,
} from "../components/ui";
import { conversationApi, userApi } from "../lib/api";
import { useFormErrors } from "../lib/useFormErrors";
import { PublicUser } from "../lib/types";

export default function NewGroup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { error, clear, setFromError } = useFormErrors();

  useEffect(() => {
    const q = query.trim();
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        // No "list all users" endpoint — search by name/email; when idle, show
        // people the user has recently chatted with (empty on a fresh account).
        const data = q ? await userApi.search(q) : await userApi.recentContacts();
        if (active) setPeople(data);
      } catch {
        if (active) setPeople([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const selectedIds = useMemo(
    () => new Set(selected.map((u) => u._id)),
    [selected]
  );

  const toggle = (user: PublicUser) => {
    setSelected((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user]
    );
  };

  const canCreate = name.trim().length > 0 && selected.length >= 1;

  const create = async () => {
    if (!canCreate) return;
    clear();
    setCreating(true);
    try {
      const conv = await conversationApi.createOrFetch({
        type: "group",
        name: name.trim(),
        participants: selected.map((u) => u._id),
      });
      router.replace(`/chat/${conv._id}`);
    } catch (e) {
      setFromError(e, "Could not create the group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="New Group" />

      <View className="px-5">
        {/* Group name */}
        <View className="flex-row items-center gap-3 rounded-2xl bg-muted px-4 py-3.5">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-100">
            <Ionicons name="people" size={20} color="#2563EB" />
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor="#94A3B8"
            className="flex-1 text-base text-ink"
            // outlineStyle removes the default web focus outline (RN Web only)
            style={{ paddingVertical: 0, outlineStyle: "none" } as any}
          />
        </View>

        {/* Selected chips */}
        {selected.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ gap: 8 }}
          >
            {selected.map((u) => (
              <Pressable
                key={u._id}
                onPress={() => toggle(u)}
                className="flex-row items-center gap-1.5 rounded-full bg-primary-50 py-1.5 pl-1.5 pr-3"
              >
                <Avatar uri={u.avatar} name={u.name} size={26} />
                <Text className="text-sm font-medium text-primary">
                  {u.name.split(" ")[0]}
                </Text>
                <Ionicons name="close-circle" size={16} color="#2563EB" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View className="mt-3">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Add people"
          />
        </View>
      </View>

      <FlatList
        data={people}
        keyExtractor={(u) => u._id}
        className="mt-2"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item._id);
          return (
            <Pressable
              onPress={() => toggle(item)}
              className="flex-row items-center gap-3 py-2.5"
            >
              <Avatar
                uri={item.avatar}
                name={item.name}
                size={46}
                online={item.isOnline}
              />
              <Text className="flex-1 text-[15px] font-semibold text-ink">
                {item.name}
              </Text>
              <View
                className={`h-6 w-6 items-center justify-center rounded-full border ${
                  isSelected ? "border-primary bg-primary" : "border-border bg-white"
                }`}
              >
                {isSelected ? (
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#2563EB" />
            </View>
          ) : query.trim() ? (
            <EmptyState
              icon="search-outline"
              title="No people found"
              message="Try a different name or email."
            />
          ) : (
            <EmptyState
              icon="people-outline"
              title="Search to add people"
              message="Find people by name or email to add them to the group."
            />
          )
        }
      />

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white px-5 pb-7 pt-3">
        {error ? (
          <View className="mb-3">
            <FormError message={error} />
          </View>
        ) : null}
        <Button
          label={
            selected.length
              ? `Create group · ${selected.length}`
              : "Create group"
          }
          onPress={create}
          loading={creating}
          disabled={!canCreate}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}
