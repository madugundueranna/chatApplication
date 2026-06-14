// Status / Stories resource — ephemeral photo/video that expires after 24h.
// Upload is multipart/form-data; the rest is plain JSON.

import { Platform } from "react-native";
import { http, unwrap } from "../http";
import { mapPublicUser, mapStatus, mapStatusGroup, mapStatusUser } from "./mappers";
import { PublicUser, Status, StatusGroup, StatusUser } from "../types";

// A picked media asset. On web we carry a real `file` (File); on native a `uri`.
export interface PickedAsset {
  uri?: string;
  file?: any; // web File (preferred when present)
  mimeType?: string | null;
  fileName?: string | null;
  type?: string | null; // 'image' | 'video' | 'file'
}

// My contacts' (and my own) active statuses, grouped by author — the Stories row.
export async function feed(): Promise<StatusGroup[]> {
  const res = await http.get("/status/feed");
  return unwrap<any[]>(res).map(mapStatusGroup);
}

// One author's active statuses (drives the fullscreen viewer).
export async function userStatuses(userId: string): Promise<StatusUser> {
  const res = await http.get(`/status/user/${userId}`);
  return mapStatusUser(unwrap<any>(res));
}

// Post a new status from a picked image/video asset.
export async function create(asset: PickedAsset, caption?: string): Promise<Status> {
  const isVideo =
    asset.type === "video" || Boolean(asset.mimeType && asset.mimeType.startsWith("video"));
  const name = asset.fileName || (isVideo ? "status.mp4" : "status.jpg");
  const mime = asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");

  const form = new FormData();
  if (asset.file) {
    // Web: a real File from the picker — append it directly.
    form.append("media", asset.file);
  } else if (Platform.OS === "web" && asset.uri) {
    // Web fallback: materialize a File from a blob:/data: URL.
    const blob = await (await fetch(asset.uri)).blob();
    form.append("media", new File([blob], name, { type: blob.type || mime }));
  } else if (asset.uri) {
    // React Native's FormData accepts a { uri, name, type } part.
    form.append("media", { uri: asset.uri, name, type: mime } as any);
  } else {
    throw new Error("No media selected");
  }
  if (caption) form.append("caption", caption);

  const res = await http.post("/status", form, {
    timeout: 120000, // video uploads can be large
    // Drop the instance's default JSON content-type so the platform (RN/browser)
    // sets multipart/form-data WITH the correct boundary for the FormData body.
    transformRequest: (data, headers) => {
      const h: any = headers;
      if (h && typeof h.delete === "function") h.delete("Content-Type");
      else if (h) delete h["Content-Type"];
      return data; // pass the FormData through untouched
    },
  });
  return mapStatus(unwrap<any>(res));
}

// Post a text-only story (a coloured card with text).
export async function createText(text: string, bgColor: string): Promise<Status> {
  const res = await http.post("/status", { text, bgColor });
  return mapStatus(unwrap<any>(res));
}

// Mark a status as seen by the current user.
export async function view(statusId: string): Promise<void> {
  await http.post(`/status/${statusId}/view`);
}

// Owner-only: who has seen this status.
export async function viewers(
  statusId: string
): Promise<{ count: number; viewers: PublicUser[] }> {
  const res = await http.get(`/status/${statusId}/viewers`);
  const data = unwrap<{ count: number; viewers: any[] }>(res);
  return { count: data.count, viewers: (data.viewers ?? []).map(mapPublicUser) };
}

export async function remove(statusId: string): Promise<void> {
  await http.delete(`/status/${statusId}`);
}
