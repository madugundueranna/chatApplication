import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, FormError, TextField } from "../../components/ui";
import { AuthScene } from "../../components/auth/AuthScene";
import { authApi } from "../../lib/api";
import { useFormErrors } from "../../lib/useFormErrors";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { error, fieldErrors, clear, setFieldErrors, setFromError } =
    useFormErrors();

  // Client-side checks so the user sees *why* the form is invalid instead of a
  // disabled button. The server re-validates and returns the same field shape.
  const validate = () => {
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = "Name is required";
    if (!/\S+@\S+\.\S+/.test(email.trim()))
      fe.email = "A valid email is required";
    if (password.length < 6)
      fe.password = "Password must be at least 6 characters";
    if (password !== confirm) fe.confirm = "Passwords do not match";
    return fe;
  };

  const onCreate = async () => {
    clear();
    const fe = validate();
    if (Object.keys(fe).length) {
      setFieldErrors(fe);
      return;
    }
    setLoading(true);
    try {
      await authApi.register(name.trim(), email.trim(), password);
      router.push({ pathname: "/(auth)/verify-otp", params: { email: email.trim() } });
    } catch (e) {
      setFromError(e, "Could not create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScene
      title={"Create\nAccount"}
      subtitle="Join Chatloop in a few seconds."
    >
      <View className="gap-4">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          leftIcon="person-outline"
          error={fieldErrors.name}
        />
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
          placeholder="At least 6 characters"
          secure
          leftIcon="lock-closed-outline"
          error={fieldErrors.password}
        />
        <TextField
          label="Confirm Password"
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

        <FormError message={error} />

        <Button
          label="Sign up"
          onPress={onCreate}
          loading={loading}
          fullWidth
          size="lg"
          rightIcon={<Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
        />
      </View>

      <View className="mt-8 flex-row justify-center gap-1">
        <Text className="text-sm text-ink-secondary">
          Already have an account?
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={6}>
            <Text className="text-sm font-semibold text-primary">Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </AuthScene>
  );
}
