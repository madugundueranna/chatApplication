// Users resource.

import { Platform } from "react-native";
import { http, unwrap } from "../http";
import { mapUser, mapPublicUser } from "./mappers";
import { PublicUser, User } from "../types";
import type { PickedAsset } from "./status";
import { list as listConversations } from "./conversations";

export async function getMe(): Promise<User> {
  const res = await http.get("/users/me");
  return mapUser(unwrap(res));
}

export async function updateMe(
  patch: Partial<Pick<User, "name" | "avatar">>
): Promise<User> {
  const res = await http.patch("/users/me", patch);
  return mapUser(unwrap(res));
}

// Upload a profile photo (multipart). Returns the updated user.
export async function uploadAvatar(asset: PickedAsset): Promise<User> {
  const name = asset.fileName || "avatar.jpg";
  const mime = asset.mimeType || "image/jpeg";

  const form = new FormData();
  if (asset.file) {
    form.append("avatar", asset.file);
  } else if (Platform.OS === "web" && asset.uri) {
    const blob = await (await fetch(asset.uri)).blob();
    form.append("avatar", new File([blob], name, { type: blob.type || mime }));
  } else if (asset.uri) {
    form.append("avatar", { uri: asset.uri, name, type: mime } as any);
  } else {
    throw new Error("No image selected");
  }

  const res = await http.post("/users/me/avatar", form, {
    timeout: 120000,
    // Clear the default JSON content-type so the platform sets the multipart boundary.
    transformRequest: (data, headers) => {
      const h: any = headers;
      if (h && typeof h.delete === "function") h.delete("Content-Type");
      else if (h) delete h["Content-Type"];
      return data;
    },
  });
  return mapUser(unwrap(res));
}

export async function search(q: string): Promise<PublicUser[]> {
  const query = q.trim();
  if (!query) return [];
  const res = await http.get("/users/search", { params: { q: query } });
  return unwrap<any[]>(res).map(mapPublicUser);
}

export async function getById(id: string): Promise<User> {
  const res = await http.get(`/users/${id}`);
  return mapUser(unwrap(res));
}

// ---- Block / report ----

export async function block(userId: string): Promise<void> {
  await http.post(`/users/block/${userId}`);
}

export async function unblock(userId: string): Promise<void> {
  await http.post(`/users/unblock/${userId}`);
}

export async function blocked(): Promise<PublicUser[]> {
  const res = await http.get("/users/blocked");
  return unwrap<any[]>(res).map(mapPublicUser);
}

export async function report(userId: string, reason: string): Promise<string> {
  const res = await http.post(`/users/report/${userId}`, { reason });
  return unwrap<{ reportId: string }>(res).reportId;
}

// There's no "list all users" endpoint; for the empty-state of the people pickers
// we suggest the people the user has recently chatted with (deduped).
export async function recentContacts(): Promise<PublicUser[]> {
  const conversations = await listConversations();
  const seen = new Map<string, PublicUser>();
  for (const c of conversations) {
    for (const p of c.otherParticipants) {
      if (!seen.has(p._id)) seen.set(p._id, p);
    }
  }
  return Array.from(seen.values());
}
