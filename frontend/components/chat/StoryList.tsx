import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../ui/Avatar";
import { StatusGroup } from "../../lib/types";
import { StoryRing } from "./StoryRing";

const AVATAR = 58;
const OUTER = AVATAR + 12; // ring box: stroke + white gap each side

// Avatar wrapped in a segmented story ring (one arc per story). When the person
// has no active story (empty "Your Story"), `viewedFlags` is empty and we draw a
// single grey ring as an affordance.
function RingAvatar({
  viewedFlags,
  empty,
  children,
}: {
  viewedFlags: boolean[];
  empty?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={{ width: OUTER, height: OUTER }} className="items-center justify-center">
      <View style={{ position: "absolute", top: 0, left: 0 }}>
        <StoryRing size={OUTER} viewedFlags={empty ? [true] : viewedFlags} />
      </View>
      <View className="rounded-full bg-white" style={{ padding: 2 }}>
        {children}
      </View>
    </View>
  );
}

function AddBadge({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="absolute bottom-0 right-0 h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-primary"
    >
      <Ionicons name="add" size={14} color="#fff" />
    </Pressable>
  );
}

type StoryListProps = {
  groups: StatusGroup[];
  myName: string;
  myAvatar?: string;
  uploading?: boolean;
  onAddStory: () => void;
  onPressGroup: (userId: string) => void;
};

export function StoryList({
  groups,
  myName,
  myAvatar,
  uploading,
  onAddStory,
  onPressGroup,
}: StoryListProps) {
  const myGroup = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 16, paddingHorizontal: 2 }}
    >
      {/* Your Story */}
      <View className="w-[72px] items-center gap-1.5">
        <Pressable
          onPress={() => (myGroup ? onPressGroup(myGroup.user._id) : onAddStory())}
          disabled={uploading}
        >
          <RingAvatar
            empty={!myGroup}
            viewedFlags={myGroup ? myGroup.statuses.map((s) => s.viewed) : []}
          >
            {uploading ? (
              <View
                style={{ width: AVATAR, height: AVATAR }}
                className="items-center justify-center rounded-full bg-muted"
              >
                <ActivityIndicator color="#2563EB" />
              </View>
            ) : (
              <Avatar uri={myAvatar} name={myName} size={AVATAR} />
            )}
          </RingAvatar>
          {!uploading ? <AddBadge onPress={onAddStory} /> : null}
        </Pressable>
        <Text className="text-xs text-ink-secondary" numberOfLines={1}>
          {uploading ? "Uploading…" : "Your Story"}
        </Text>
      </View>

      {/* Contacts with active statuses */}
      {others.map((g) => (
        <Pressable
          key={g.user._id}
          onPress={() => onPressGroup(g.user._id)}
          className="w-[72px] items-center gap-1.5"
        >
          <RingAvatar viewedFlags={g.statuses.map((s) => s.viewed)}>
            <Avatar uri={g.user.avatar} name={g.user.name} size={AVATAR} />
          </RingAvatar>
          <Text className="text-xs text-ink-secondary" numberOfLines={1}>
            {g.user.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
