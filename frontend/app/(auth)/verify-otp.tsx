import { useEffect, useRef, useState } from "react";
import {
  NativeSyntheticEvent,
  Pressable,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, FormError, Logo } from "../../components/ui";
import { authApi } from "../../lib/api";
import { ApiError } from "../../lib/http";

const LENGTH = 6;

export default function VerifyOtp() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const code = digits.join("");
  const complete = code.length === LENGTH;

  const setDigit = (index: number, value: string) => {
    const char = value.replace(/[^0-9]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const onKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
    }
  };

  const onVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      await authApi.verifyOtp(email ?? "", code);
      // Verification issues no tokens — send the user to sign in.
      router.replace("/(auth)/login");
    } catch (e) {
      setError((e as ApiError).message ?? "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (seconds > 0) return;
    setError(null);
    try {
      await authApi.resendOtp(email ?? "");
      setSeconds(30);
    } catch (e) {
      setError((e as ApiError).message ?? "Could not resend the code.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-6">
      <View className="flex-1 justify-center">
        <View className="items-center">
          <Logo size="lg" showWordmark={false} />
          <Text className="mt-5 text-2xl font-bold text-ink">Verify it's you</Text>
          <Text className="mt-2 text-center text-base text-ink-secondary">
            Enter the 6-digit code we sent to
          </Text>
          <Text className="text-base font-semibold text-ink">
            {email ?? "your email"}
          </Text>
        </View>

        <View className="mt-10 flex-row justify-between">
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                inputs.current[i] = r;
              }}
              value={d}
              onChangeText={(v) => setDigit(i, v)}
              onKeyPress={(e) => onKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
              className={`h-14 w-12 rounded-2xl bg-muted text-center text-xl font-semibold text-ink ${
                d ? "border border-primary" : ""
              }`}
              // outlineStyle removes the default web focus outline (RN Web only)
              style={{ outlineStyle: "none" } as any}
            />
          ))}
        </View>

        {error ? (
          <View className="mt-4">
            <FormError message={error} />
          </View>
        ) : null}

        <View className="mt-8">
          <Button
            label="Verify"
            onPress={onVerify}
            loading={loading}
            disabled={!complete}
            fullWidth
            size="lg"
          />
        </View>

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-sm text-ink-secondary">Didn't get a code?</Text>
          <Pressable onPress={onResend} disabled={seconds > 0} hitSlop={6}>
            <Text
              className={`text-sm font-semibold ${
                seconds > 0 ? "text-ink-muted" : "text-primary"
              }`}
            >
              {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
