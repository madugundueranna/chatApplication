import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, FormError, Logo, TextField } from "../../components/ui";
import { authApi } from "../../lib/api";
import { useFormErrors } from "../../lib/useFormErrors";

const LENGTH = 6;

export default function ResetPassword() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { error, fieldErrors, clear, setError, setFieldErrors, setFromError } =
    useFormErrors();

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const code = digits.join("");

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

  const onReset = async () => {
    clear();
    if (code.length < LENGTH) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    const fe: Record<string, string> = {};
    if (password.length < 6)
      fe.password = "Password must be at least 6 characters";
    if (password !== confirm) fe.confirm = "Passwords do not match";
    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(email ?? "", code, password);
      router.replace("/(auth)/login");
    } catch (e) {
      setFromError(e, "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (seconds > 0 || !email) return;
    clear();
    try {
      await authApi.forgotPassword(email);
      setSeconds(30);
    } catch (e) {
      setFromError(e, "Could not resend the code.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Logo size="lg" showWordmark={false} />
            <Text className="mt-5 text-2xl font-bold text-ink">Reset password</Text>
            <Text className="mt-2 text-center text-base text-ink-secondary">
              Enter the code we sent to
            </Text>
            <Text className="text-base font-semibold text-ink">
              {email ?? "your email"}
            </Text>
          </View>

          <View className="mt-8 flex-row justify-between">
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
                style={{ outlineStyle: "none" } as any}
              />
            ))}
          </View>

          <View className="mt-6 gap-4">
            <TextField
              label="New password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secure
              leftIcon="lock-closed-outline"
              error={fieldErrors.password}
            />
            <TextField
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Re-enter password"
              secure
              leftIcon="lock-closed-outline"
              error={
                fieldErrors.confirm ??
                (confirm && confirm !== password ? "Passwords do not match" : undefined)
              }
            />
          </View>

          {error ? (
            <View className="mt-4">
              <FormError message={error} />
            </View>
          ) : null}

          <View className="mt-6">
            <Button
              label="Reset password"
              onPress={onReset}
              loading={loading}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
