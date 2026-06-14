// Messages resource. Sending is normally done over the socket (optimistic UI +
// ack); this REST `send` is the fallback / non-realtime path.

import { Platform } from "react-native";
import { http, unwrap } from "../http";
import { mapMessage } from "./mappers";
import { GetMessagesOpts, Message, MessageType } from "../types";
import type { PickedAsset } from "./status";

export async function send(
  conversationId: string,
  content: string,
  type: MessageType = "text"
): Promise<Message> {
  const res = await http.post("/messages", { conversationId, content, type });
  return mapMessage(unwrap(res));
}

// Send a picked file (PDF or image, ≤10MB) as a message. The backend verifies and
// uploads it to Cloudinary server-side, then returns the saved message with its
// real media URL — so this reuses POST /api/messages (multipart), not a separate
// upload step. The backend derives the message type (image|file) from the content.
export async function sendFile(
  conversationId: string,
  asset: PickedAsset,
  caption?: string
): Promise<Message> {
  const isImage =
    asset.type === "image" || Boolean(asset.mimeType && asset.mimeType.startsWith("image"));
  const name = asset.fileName || (isImage ? "image.jpg" : "document.pdf");
  const mime = asset.mimeType || (isImage ? "image/jpeg" : "application/pdf");

  const form = new FormData();
  if (asset.file) {
    // Web: a real File from the picker — append it directly.
    form.append("file", asset.file);
  } else if (Platform.OS === "web" && asset.uri) {
    // Web fallback: materialize a File from a blob:/data: URL.
    const blob = await (await fetch(asset.uri)).blob();
    form.append("file", new File([blob], name, { type: blob.type || mime }));
  } else if (asset.uri) {
    // React Native's FormData accepts a { uri, name, type } part.
    form.append("file", { uri: asset.uri, name, type: mime } as any);
  } else {
    throw new Error("No file selected");
  }
  form.append("conversationId", conversationId);
  if (caption) form.append("caption", caption);

  const res = await http.post("/messages", form, {
    timeout: 120000,
    // Drop the instance's default JSON content-type so the platform (RN/browser)
    // sets multipart/form-data WITH the correct boundary for the FormData body.
    transformRequest: (data, headers) => {
      const h: any = headers;
      if (h && typeof h.delete === "function") h.delete("Content-Type");
      else if (h) delete h["Content-Type"];
      return data; // pass the FormData through untouched
    },
  });
  return mapMessage(unwrap(res));
}

export async function history(
  conversationId: string,
  opts: GetMessagesOpts = {}
): Promise<{ items: Message[]; nextCursor: string | null }> {
  const params: Record<string, string | number> = {};
  if (opts.cursor) params.cursor = opts.cursor;
  if (opts.limit) params.limit = opts.limit;
  const res = await http.get(`/messages/${conversationId}`, { params });
  const data = unwrap<{ items: any[]; nextCursor: string | null }>(res);
  return {
    items: data.items.map(mapMessage),
    nextCursor: data.nextCursor ?? null,
  };
}

export async function markRead(messageId: string): Promise<void> {
  await http.patch(`/messages/${messageId}/read`);
}

export async function markConversationRead(
  conversationId: string
): Promise<{ modified: number }> {
  const res = await http.post(`/messages/${conversationId}/read`);
  return unwrap(res);
}

// scope "everyone" (default, sender-only within a time window) soft-deletes for
// all; "me" hides it for the current user only.
export async function remove(
  messageId: string,
  scope: "me" | "everyone" = "everyone"
): Promise<void> {
  await http.delete(`/messages/${messageId}`, { params: { scope } });
}
