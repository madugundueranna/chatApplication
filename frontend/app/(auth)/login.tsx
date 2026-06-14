import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, FormError, TextField } from "../../components/ui";
import { AuthScene } from "../../components/auth/AuthScene";
import { useAuth } from "../../lib/auth";
import { ApiError } from "../../lib/http";
import { useFormErrors } from "../../lib/useFormErrors";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { error, fieldErrors, clear, setFieldErrors, setFromError } =
    useFormErrors();

  // Per-field client checks so each input shows its own message; the server
  // re-validates and returns the same field shape.
  const validate = () => {
    const fe: Record<string, string> = {};
    if (!email.trim()) fe.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email.trim()))
      fe.email = "A valid email is required";
    if (!password) fe.password = "Password is required";
    return fe;
  };

  const onLogin = async () => {
    clear();
    const fe = validate();
    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      // Not verified yet — send them to OTP verification.
      if ((e as ApiError).status === 403) {
        router.push({ pathname: "/(auth)/verify-otp", params: { email: email.trim() } });
        return;
      }
      setFromError(e, "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScene
      title={"Welcome\nBack"}
      subtitle="Sign in to pick up right where you left off."
    >
      <View className="gap-4">
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@chatloop.app"
          keyboardType="email-address"
          leftIcon="mail-outline"
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secure
          leftIcon="lock-closed-outline"
          error={fieldErrors.password}
        />

        <Link href="/(auth)/forgot-password" asChild>
          <Pressable className="self-end" hitSlop={6}>
            <Text className="text-sm font-medium text-primary">
              Forgot password?
            </Text>
          </Pressable>
        </Link>

        <FormError message={error} />

        <Button
          label="Sign in"
          onPress={onLogin}
          loading={loading}
          fullWidth
          size="lg"
          rightIcon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
        />
      </View>

      <View className="mt-8 flex-row justify-center gap-1">
        <Text className="text-sm text-ink-secondary">
          Don't have an account?
        </Text>
        <Link href="/(auth)/register" asChild>
          <Pressable hitSlop={6}>
            <Text className="text-sm font-semibold text-primary">Register</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScene>
  );
}
