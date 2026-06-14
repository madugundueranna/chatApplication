// Small presentation helpers used across screens.

/** Short time for chat rows / message timestamps, e.g. "9:01 AM". */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return time;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "Yesterday";

  // within the last week -> weekday, else short date
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

/** Presence line for a contact, e.g. "online" or "last seen 2h ago". */
export function formatLastSeen(iso: string | null, isOnline?: boolean): string {
  if (isOnline) return "online";
  if (!iso) return "offline";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "offline";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "last seen yesterday";
  if (days < 7) return `last seen ${days}d ago`;
  return `last seen ${d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  })}`;
}

/** A day label for message separators: "Today" / "Yesterday" / "12 Jun 2026". */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayMs = 86400000;
  const diff = Math.round((startOf(now) - startOf(d)) / dayMs);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Relative short label, e.g. "20 sec", "Yesterday", "Last Week". */
export function formatRelativeShort(iso: string | null): string {
  if (!iso) return "now";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${Math.max(secs, 1)} sec`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days`;
  if (days < 14) return "Last Week";
  const weeks = Math.floor(days / 7);
  return `${weeks} weeks`;
}

/** Up to two initials from a display name. Strips emoji/symbols. */
export function initials(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

/** One-line preview for a conversation row, accounting for media types. */
export function previewText(
  msg: { type: string; content: string } | null | undefined
): string {
  if (!msg) return "No messages yet";
  if (msg.type === "image") return "📷 Photo";
  if (msg.type === "file") return "📎 File";
  return msg.content;
}
