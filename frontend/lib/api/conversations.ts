// Conversations resource.

import { http, unwrap } from "../http";
import { mapConversationDetail, mapConversationListItem } from "./mappers";
import { Conversation, CreateConversationInput } from "../types";

// Start (or fetch an existing) direct chat, or create a group. The backend
// returns a populated conversation either way.
export async function createOrFetch(
  input: CreateConversationInput
): Promise<Conversation> {
  const res = await http.post("/conversations", input);
  return mapConversationDetail(unwrap(res));
}

export async function list(): Promise<Conversation[]> {
  const res = await http.get("/conversations");
  return unwrap<any[]>(res).map(mapConversationListItem);
}

export async function getById(id: string): Promise<Conversation> {
  const res = await http.get(`/conversations/${id}`);
  return mapConversationDetail(unwrap(res));
}

export async function remove(id: string): Promise<void> {
  await http.delete(`/conversations/${id}`);
}

// Clear history for me only (WhatsApp-style — others keep their copy).
export async function clear(id: string): Promise<void> {
  await http.post(`/conversations/${id}/clear`);
}

export async function mute(id: string): Promise<void> {
  await http.post(`/conversations/${id}/mute`);
}

export async function unmute(id: string): Promise<void> {
  await http.post(`/conversations/${id}/unmute`);
}
