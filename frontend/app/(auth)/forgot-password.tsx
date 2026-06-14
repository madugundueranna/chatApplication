import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, FormError, TextField } from "../../components/ui";
import { AuthScene } from "../../components/auth/AuthScene";
import { authApi } from "../../lib/api";
import { useFormErrors } from "../../lib/useFormErrors";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { error, fieldErrors, clear, setFieldErrors, setFromError } =
    useFormErrors();

  // Request a reset code, then continue to the reset screen where the user enters
  // the emailed code + a new password. The backend always responds 200 (it won't
  // reveal whether the email is registered), so we navigate on success.
  const onSend = async () => {
    clear();
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setFieldErrors({ email: "Enter a valid email address." });
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      router.push({
        pathname: "/(auth)/reset-password",
        params: { email: email.trim() },
      });
    } catch (e) {
      setFromError(e, "Could not send the reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScene
      title={"Forgot\nPassword"}
      subtitle="Enter your email and we'll send you a reset code."
    >
      <View className="gap-4">
        <TextField
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (fieldErrors.email || error) clear();
          }}
          placeholder="you@chatloop.app"
          keyboardType="email-address"
          autoFocus
          leftIcon="mail-outline"
          error={fieldErrors.email}
        />

        <FormError message={error} />

        <Button
          label="Send reset code"
          onPress={onSend}
          loading={loading}
          fullWidth
          size="lg"
          rightIcon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
        />
      </View>

      <View className="mt-8 flex-row justify-center gap-1">
        <Text className="text-sm text-ink-secondary">Remembered it?</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={6}>
            <Text className="text-sm font-semibold text-primary">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScene>
  );
}
