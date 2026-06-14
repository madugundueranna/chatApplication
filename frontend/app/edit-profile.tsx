import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, FormError, ScreenHeader, TextField } from "../components/ui";
import { userApi } from "../lib/api";
import { useAuth } from "../lib/auth";
import { pickAvatarImage } from "../lib/media";
import { useFormErrors } from "../lib/useFormErrors";

export default function EditProfile() {
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { error, fieldErrors, clear, setFieldErrors, setFromError } =
    useFormErrors();

  useEffect(() => {
    userApi.getMe().then((u) => {
      setName(u.name);
      setAvatar(u.avatar);
      setEmail(u.email);
    });
  }, []);

  // Tap the avatar → pick an image → upload it → reflect the new photo.
  const onPickPhoto = async () => {
    clear();
    let media;
    try {
      media = await pickAvatarImage();
    } catch (e) {
      setFromError(e, "Couldn't open the photo picker.");
      return;
    }
    if (!media) return;
    try {
      setUploadingPhoto(true);
      const updated = await userApi.uploadAvatar(media);
      setAvatar(updated.avatar);
      setCurrentUser(updated);
    } catch (e) {
      setFromError(e, "Could not upload your photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = async () => {
    clear();
    if (!name.trim()) {
      setFieldErrors({ name: "Name is required" });
      return;
    }
    setSaving(true);
    try {
      const updated = await userApi.updateMe({
        name: name.trim(),
        avatar: avatar.trim(),
      });
      setCurrentUser(updated);
      router.back();
    } catch (e) {
      setFromError(e, "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Edit Profile" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Pressable onPress={onPickPhoto} disabled={uploadingPhoto}>
              <Avatar uri={avatar} name={name} size={104} ring />
              <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary">
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                )}
              </View>
            </Pressable>
            <Text className="mt-2 text-sm text-ink-muted">
              Tap the photo to upload — or paste an image URL below
            </Text>
          </View>

          <View className="mt-8 gap-4">
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
              label="Avatar URL"
              value={avatar}
              onChangeText={setAvatar}
              placeholder="https://…"
              leftIcon="image-outline"
              error={fieldErrors.avatar}
            />

            {/* Read-only */}
            <View className="gap-1.5">
              <Text className="ml-1 text-sm font-medium text-ink-secondary">
                Email
              </Text>
              <View className="h-14 flex-row items-center gap-2 rounded-2xl bg-muted px-4 opacity-60">
                <Ionicons name="mail-outline" size={20} color="#94A3B8" />
                <Text className="flex-1 text-base text-ink-secondary">
                  {email}
                </Text>
                <Ionicons name="lock-closed" size={16} color="#94A3B8" />
              </View>
              <Text className="ml-1 text-xs text-ink-muted">
                Email and password can't be changed here.
              </Text>
            </View>

            <FormError message={error} />

            <View className="mt-2">
              <Button
                label="Save changes"
                onPress={save}
                loading={saving}
                fullWidth
                size="lg"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
