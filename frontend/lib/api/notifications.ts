// Notifications resource. In-app notification center + Expo push-token registration.
// (Notifications are CREATED server-side by other actions; the client only reads
// and manages them here.)

import { http, unwrap } from "../http";
import { mapNotification } from "./mappers";
import { AppNotification, GetMessagesOpts } from "../types";

export async function list(
  opts: GetMessagesOpts = {}
): Promise<{ items: AppNotification[]; nextCursor: string | null }> {
  const params: Record<string, string | number> = {};
  if (opts.cursor) params.cursor = opts.cursor;
  if (opts.limit) params.limit = opts.limit;
  const res = await http.get("/notifications", { params });
  const data = unwrap<{ items: any[]; nextCursor: string | null }>(res);
  return { items: data.items.map(mapNotification), nextCursor: data.nextCursor ?? null };
}

export async function unreadCount(): Promise<number> {
  const res = await http.get("/notifications/unread-count");
  return unwrap<{ count: number }>(res).count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  await http.patch(`/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
  await http.patch("/notifications/read-all");
}

export async function remove(id: string): Promise<void> {
  await http.delete(`/notifications/${id}`);
}

// --- Expo push tokens ---

export async function registerPushToken(token: string): Promise<void> {
  await http.post("/notifications/push-tokens", { token });
}

export async function removePushToken(token: string): Promise<void> {
  await http.delete("/notifications/push-tokens", { data: { token } });
}
