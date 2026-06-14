// Fullscreen status/story viewer.
//
// Shows one author's active statuses with segmented progress bars, auto-advance
// (5s per image / the clip length per video), tap-left/right to move, hold to
// pause. Each shown status is marked seen. For my own statuses it also shows the
// viewer count (tap to list) and a delete control.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { conversationApi, messageApi, statusApi } from "../../lib/api";
import { Avatar } from "../../components/ui/Avatar";
import { PublicUser, StatusUser } from "../../lib/types";

const IMAGE_DURATION = 5000; // ms a photo stays on screen

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StatusViewer() {
  const { userId: rawUserId } = useLocalSearchParams<{ userId: string }>();
  const userId = String(rawUserId);
  const router = useRouter();

  const [data, setData] = useState<StatusUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewerList, setViewerList] = useState<PublicUser[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const progressRef = useRef(0);
  const viewedRef = useRef<Set<string>>(new Set());

  const statuses = data?.statuses ?? [];
  const current = statuses[index];
  const isMine = data?.isMine ?? false;

  // One reusable player; its source is swapped per video status.
  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  // Load this author's active statuses.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await statusApi.userStatuses(userId);
        if (active) setData(res);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Couldn't load status");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [router]);

  const goTo = useCallback(
    (next: number) => {
      progressRef.current = 0;
      setProgress(0);
      if (next < 0) {
        setIndex(0);
        return;
      }
      if (next >= statuses.length) {
        close();
        return;
      }
      setIndex(next);
    },
    [statuses.length, close]
  );

  // Mark the current status seen once. The backend no-ops for the owner.
  useEffect(() => {
    if (!current) return;
    if (!viewedRef.current.has(current._id)) {
      viewedRef.current.add(current._id);
      statusApi.view(current._id).catch(() => {});
    }
  }, [current?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Swap the video source (or pause the player for images) per status.
  useEffect(() => {
    if (!current) return;
    if (current.type === "video") {
      try {
        player.replace(current.mediaUrl);
        player.currentTime = 0;
        if (!paused) player.play();
      } catch {
        /* player not ready */
      }
    } else {
      try {
        player.pause();
      } catch {
        /* noop */
      }
    }
  }, [current?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reflect pause/resume onto the video.
  useEffect(() => {
    if (current?.type !== "video") return;
    try {
      paused ? player.pause() : player.play();
    } catch {
      /* noop */
    }
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress timer: fills the active segment and auto-advances.
  useEffect(() => {
    if (loading || !current || paused) return;
    const dur =
      current.type === "video" ? Math.max((current.duration || 5) * 1000, 1000) : IMAGE_DURATION;
    const start = Date.now() - progressRef.current * dur;
    const id = setInterval(() => {
      const p = Math.min((Date.now() - start) / dur, 1);
      progressRef.current = p;
      setProgress(p);
      if (p >= 1) {
        clearInterval(id);
        goTo(index + 1);
      }
    }, 50);
    return () => clearInterval(id);
  }, [index, paused, loading, current?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openViewers = useCallback(async () => {
    if (!current) return;
    setPaused(true);
    try {
      const res = await statusApi.viewers(current._id);
      setViewerList(res.viewers);
    } catch {
      setViewerList([]);
    } finally {
      setShowViewers(true);
    }
  }, [current]);

  const closeViewers = useCallback(() => {
    setShowViewers(false);
    setPaused(false);
  }, []);

  // Reply to someone's story → sends a normal DM into your chat with them.
  const sendReply = useCallback(async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const conv = await conversationApi.createOrFetch({
        type: "direct",
        participantId: userId,
      });
      await messageApi.send(conv._id, text);
      setReplyText("");
      Alert.alert("Sent", `Your reply was sent to ${data?.user.name ?? "them"}.`);
    } catch (e: any) {
      Alert.alert("Couldn't send", e?.message ?? "Please try again.");
    } finally {
      setSending(false);
      setPaused(false);
    }
  }, [replyText, sending, userId, data?.user.name]);

  const onDelete = useCallback(() => {
    if (!current) return;
    Alert.alert("Delete status", "Remove this status for everyone?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await statusApi.remove(current._id);
            const remaining = statuses.filter((s) => s._id !== current._id);
            if (!remaining.length) {
              close();
              return;
            }
            setData((d) => (d ? { ...d, statuses: remaining } : d));
            setIndex((i) => Math.min(i, remaining.length - 1));
            progressRef.current = 0;
            setProgress(0);
          } catch (e: any) {
            Alert.alert("Couldn't delete", e?.message ?? "Please try again.");
          }
        },
      },
    ]);
  }, [current, statuses, close]);

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#fff" />
          </View>
        ) : error || !current ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="mb-4 text-center text-white">{error ?? "No status to show."}</Text>
            <Pressable onPress={close} className="rounded-full bg-white/20 px-6 py-2">
              <Text className="text-white">Close</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Media layer */}
            <View className="absolute inset-0 items-center justify-center bg-black">
              {current.type === "video" ? (
                <VideoView
                  player={player}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                  nativeControls={false}
                />
              ) : current.type === "text" ? (
                <View
                  className="flex-1 items-center justify-center self-stretch px-8"
                  style={{ backgroundColor: current.bgColor || "#2563EB" }}
                >
                  <Text className="text-center text-2xl font-semibold leading-9 text-white">
                    {current.text}
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: current.mediaUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Tap zones: left = previous, right = next, hold = pause */}
            <View className="absolute inset-0 flex-row">
              <Pressable
                className="flex-1"
                onPress={() => goTo(index - 1)}
                onLongPress={() => setPaused(true)}
                onPressOut={() => setPaused(false)}
                delayLongPress={150}
              />
              <Pressable
                className="flex-1"
                onPress={() => goTo(index + 1)}
                onLongPress={() => setPaused(true)}
                onPressOut={() => setPaused(false)}
                delayLongPress={150}
              />
            </View>

            {/* Top: progress segments + author header */}
            <View className="px-3 pt-2">
              <View className="flex-row gap-1">
                {statuses.map((s, i) => (
                  <View
                    key={s._id}
                    className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
                  >
                    <View
                      className="h-full bg-white"
                      style={{
                        width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`,
                      }}
                    />
                  </View>
                ))}
              </View>

              <View className="mt-3 flex-row items-center gap-3">
                <Avatar uri={data?.user.avatar} name={data?.user.name} size={36} />
                <View className="flex-1">
                  <Text className="font-semibold text-white" numberOfLines={1}>
                    {isMine ? "My Status" : data?.user.name}
                  </Text>
                  <Text className="text-xs text-white/70">{timeAgo(current.createdAt)}</Text>
                </View>
                <Pressable
                  onPress={close}
                  hitSlop={10}
                  className="h-9 w-9 items-center justify-center"
                >
                  <Ionicons name="close" size={26} color="#fff" />
                </Pressable>
              </View>
            </View>

            {/* Caption */}
            {current.caption ? (
              <View className="absolute inset-x-0 bottom-24 px-6">
                <Text className="text-center text-base text-white">{current.caption}</Text>
              </View>
            ) : null}

            {/* Owner footer: viewer count + delete */}
            {isMine ? (
              <View className="absolute inset-x-0 bottom-6 flex-row items-center justify-center gap-10">
                <Pressable onPress={openViewers} className="flex-row items-center gap-1.5">
                  <Ionicons name="eye-outline" size={22} color="#fff" />
                  <Text className="text-white">{current.viewersCount ?? 0}</Text>
                </Pressable>
                <Pressable onPress={onDelete} className="flex-row items-center gap-1.5">
                  <Ionicons name="trash-outline" size={22} color="#fff" />
                  <Text className="text-white">Delete</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Reply bar (others' stories) — sends a normal DM. */}
            {!isMine ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                className="absolute inset-x-0 bottom-0"
              >
                <View className="flex-row items-center gap-2 px-4 pb-6 pt-2">
                  <TextInput
                    value={replyText}
                    onChangeText={setReplyText}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    placeholder={`Reply to ${data?.user.name ?? "story"}…`}
                    placeholderTextColor="rgba(255,255,255,0.6)"
                    returnKeyType="send"
                    onSubmitEditing={sendReply}
                    className="flex-1 rounded-full border border-white/40 px-4 py-2.5 text-white"
                  />
                  <Pressable
                    onPress={sendReply}
                    disabled={sending || !replyText.trim()}
                    className="h-11 w-11 items-center justify-center rounded-full bg-primary"
                    style={{ opacity: sending || !replyText.trim() ? 0.5 : 1 }}
                  >
                    <Ionicons name="send" size={18} color="#fff" />
                  </Pressable>
                </View>
              </KeyboardAvoidingView>
            ) : null}
          </>
        )}
      </SafeAreaView>

      {/* Viewers list (owner) */}
      <Modal visible={showViewers} transparent animationType="slide" onRequestClose={closeViewers}>
        <Pressable className="flex-1 justify-end bg-black/50" onPress={closeViewers}>
          <Pressable className="max-h-[60%] rounded-t-3xl bg-white p-5" onPress={() => {}}>
            <Text className="mb-3 text-base font-semibold text-ink">
              Viewed by {viewerList.length}
            </Text>
            <FlatList
              data={viewerList}
              keyExtractor={(u) => u._id}
              ListEmptyComponent={
                <Text className="py-6 text-center text-ink-secondary">No views yet</Text>
              }
              renderItem={({ item }) => (
                <View className="flex-row items-center gap-3 py-2">
                  <Avatar uri={item.avatar} name={item.name} size={40} />
                  <Text className="text-ink">{item.name}</Text>
                </View>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
