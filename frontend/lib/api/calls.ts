// Calls resource (read-only REST). Call lifecycle/signaling happens over the
// socket (see lib/call.tsx); these endpoints serve ICE config and history.

import { http, unwrap } from "../http";
import { mapCall } from "./mappers";
import { Call, GetMessagesOpts } from "../types";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// STUN/TURN config resolved server-side (keeps any TURN API key off the client).
export async function iceServers(): Promise<IceServer[]> {
  const res = await http.get("/calls/ice-servers");
  return unwrap<{ iceServers: IceServer[] }>(res).iceServers ?? [];
}

export async function history(
  opts: GetMessagesOpts = {}
): Promise<{ items: Call[]; nextCursor: string | null }> {
  const params: Record<string, string | number> = {};
  if (opts.cursor) params.cursor = opts.cursor;
  if (opts.limit) params.limit = opts.limit;
  const res = await http.get("/calls", { params });
  const data = unwrap<{ items: any[]; nextCursor: string | null }>(res);
  return { items: data.items.map(mapCall), nextCursor: data.nextCursor ?? null };
}

export async function getById(id: string): Promise<Call> {
  const res = await http.get(`/calls/${id}`);
  return mapCall(unwrap(res));
}
