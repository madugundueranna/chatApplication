// Media pickers for statuses, avatars and chat attachments.
//
// Native uses expo-image-picker / expo-document-picker. Web uses a self-managed
// <input type="file"> rather than the libraries' injected input: form-filler
// browser extensions (password managers, autofill, Grammarly) try to set `.value`
// on any file input they see — which the browser forbids — throwing an uncaught
// error from THEIR content script. Keeping our input off-screen, hinting extensions
// to skip it, and removing it immediately minimizes that, and returns a real File
// for upload.

import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { PickedAsset } from "./api/status";

// Pick a photo or short video (for a status).
export function pickStatusMedia(): Promise<PickedAsset | null> {
  return pickFromLibrary({ allowVideo: true });
}

// Pick an image only (for a profile avatar).
export function pickAvatarImage(): Promise<PickedAsset | null> {
  return pickFromLibrary({ allowVideo: false });
}

// Pick an image from the library (for a chat attachment).
export function pickImageFromLibrary(): Promise<PickedAsset | null> {
  return pickFromLibrary({ allowVideo: false });
}

// Take a photo with the camera (for a chat attachment).
export async function pickCameraPhoto(): Promise<PickedAsset | null> {
  // The web file dialog has no camera mode; fall back to choosing an image file.
  if (Platform.OS === "web") return pickWebFile("image/*");

  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("Allow camera access to continue.");

  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled || !result.assets?.length) return null;

  const a = result.assets[0];
  return { uri: a.uri, mimeType: a.mimeType, fileName: a.fileName, type: a.type };
}

// Pick a document — a PDF or an image (for a chat attachment). The backend accepts
// only PDFs and images for messages, so the picker is scoped to those.
export async function pickDocument(): Promise<PickedAsset | null> {
  if (Platform.OS === "web") return pickWebFile("application/pdf,image/*");

  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  const a = result.assets[0];
  return {
    uri: a.uri,
    mimeType: a.mimeType,
    fileName: a.name,
    type: a.mimeType?.startsWith("image") ? "image" : "file",
  };
}

async function pickFromLibrary({
  allowVideo,
}: {
  allowVideo: boolean;
}): Promise<PickedAsset | null> {
  if (Platform.OS === "web") return pickWebFile(allowVideo ? "image/*,video/*" : "image/*");

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted)
    throw new Error(`Allow photo${allowVideo ? " & video" : ""} access to continue.`);

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: allowVideo ? ["images", "videos"] : ["images"],
    quality: 0.8,
    videoMaxDuration: 30,
  });
  if (result.canceled || !result.assets?.length) return null;

  const a = result.assets[0];
  return { uri: a.uri, mimeType: a.mimeType, fileName: a.fileName, type: a.type };
}

// `accept` is a standard input accept string (e.g. "image/*", "application/pdf,image/*").
function pickWebFile(accept: string): Promise<PickedAsset | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.setAttribute("aria-hidden", "true");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("data-lpignore", "true"); // LastPass: skip this field
    input.setAttribute("data-1p-ignore", "true"); // 1Password: skip this field

    let settled = false;
    const finish = (value: PickedAsset | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      try {
        input.remove();
      } catch {
        /* noop */
      }
      resolve(value);
    };

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      finish({
        file,
        fileName: file.name,
        mimeType: file.type,
        type: file.type.startsWith("video")
          ? "video"
          : file.type.startsWith("image")
            ? "image"
            : "file",
      });
    };

    // The file dialog fires no "cancel" event; when the window regains focus and
    // no file was chosen shortly after, treat it as a cancel and clean up.
    const onWindowFocus = () => {
      setTimeout(() => finish(null), 500);
    };
    window.addEventListener("focus", onWindowFocus);

    document.body.appendChild(input);
    input.click();
  });
}
