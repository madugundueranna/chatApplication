import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

function Dot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.delay(450 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, v]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <Animated.View
      style={{ transform: [{ translateY }], opacity }}
      className="h-2 w-2 rounded-full bg-ink-muted"
    />
  );
}

export function TypingIndicator() {
  return (
    <View className="mb-1.5 items-start px-3">
      <View className="flex-row items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}
