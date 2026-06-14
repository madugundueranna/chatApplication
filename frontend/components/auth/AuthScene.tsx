import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

type AuthSceneProps = {
  /** Big heading shown over the navy blob. Use "\n" for a line break. */
  title: string;
  subtitle: string;
  children: ReactNode;
};

const HEAD = 300; // height of the navy header blob
const FOOT = 170; // height of the blue footer wave

/**
 * Shared auth backdrop: a dark navy blob up top (heading sits on it) and a blue
 * gradient wave pinned to the bottom. Uses the project palette (ink + primary)
 * instead of the reference green. The form is passed as children and flows in
 * the white space between the two decorations.
 */
export function AuthScene({ title, subtitle, children }: AuthSceneProps) {
  const { width: W } = useWindowDimensions();

  // Navy header: full-width top filled down to an organic wavy edge.
  const headPath =
    `M0 0 H${W} V190 ` +
    `C ${W * 0.82} 268 ${W * 0.58} 150 ${W * 0.4} 210 ` +
    `C ${W * 0.22} 256 ${W * 0.1} 224 0 244 Z`;

  // Soft accent blob tucked into the top-right for depth.
  const accentPath =
    `M${W} 0 H${W * 0.45} ` +
    `C ${W * 0.7} 70 ${W * 0.78} 150 ${W} 130 Z`;

  // Blue footer wave: organic top edge filling down to the bottom of the screen.
  const footPath =
    `M0 ${FOOT} H${W} V64 ` +
    `C ${W * 0.78} 8 ${W * 0.58} 116 ${W * 0.38} 80 ` +
    `C ${W * 0.2} 52 ${W * 0.08} 100 0 76 Z`;

  // Lighter wave behind the main one for a layered look.
  const footBackPath =
    `M0 ${FOOT} H${W} V104 ` +
    `C ${W * 0.74} 150 ${W * 0.5} 70 ${W * 0.28} 110 ` +
    `C ${W * 0.12} 138 ${W * 0.05} 120 0 128 Z`;

  return (
    <View className="flex-1 bg-white">
      {/* Header blob */}
      <Svg
        width={W}
        height={HEAD}
        style={{ position: "absolute", top: 0, left: 0 }}
        pointerEvents="none"
      >
        <Path d={headPath} fill="#0F172A" />
        <Path d={accentPath} fill="#1D4ED8" opacity={0.45} />
      </Svg>

      {/* Footer wave */}
      <Svg
        width={W}
        height={FOOT}
        style={{ position: "absolute", bottom: 0, left: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient
            id="authBlue"
            x1="0"
            y1="0"
            x2={W}
            y2={FOOT}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#3B82F6" />
            <Stop offset="1" stopColor="#1D4ED8" />
          </LinearGradient>
        </Defs>
        <Path d={footBackPath} fill="#93C5FD" opacity={0.4} />
        <Path d={footPath} fill="url(#authBlue)" />
      </Svg>

      <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 150 }}
          >
            {/* Heading over the navy blob */}
            <View
              className="justify-end px-7 pb-7"
              style={{ minHeight: HEAD - 36 }}
            >
              <Text className="text-4xl font-bold leading-tight text-white">
                {title}
              </Text>
              <Text className="mt-2 text-base text-primary-100">{subtitle}</Text>
            </View>

            {/* Form */}
            <View className="px-7 pt-4">{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
