import type { Conversation } from '../types/conversation';

export type DateGroup = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Older';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getDateGroup(timestamp: number, now: number = Date.now()): DateGroup {
  const today = startOfLocalDay(now);
  if (timestamp >= today) return 'Today';
  if (timestamp >= today - DAY_MS) return 'Yesterday';
  if (timestamp >= today - 7 * DAY_MS) return 'Previous 7 Days';
  return 'Older';
}

export const DATE_GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'Previous 7 Days', 'Older'];

/** Sorts by most recent activity and groups into date buckets (empty groups omitted). */
export function groupConversations(
  conversations: Conversation[],
  now: number = Date.now(),
): { group: DateGroup; conversations: Conversation[] }[] {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const buckets = new Map<DateGroup, Conversation[]>();
  for (const c of sorted) {
    const g = getDateGroup(c.updatedAt, now);
    const list = buckets.get(g) ?? [];
    list.push(c);
    buckets.set(g, list);
  }
  return DATE_GROUP_ORDER.filter((g) => buckets.has(g)).map((g) => ({ group: g, conversations: buckets.get(g)! }));
}

/** "Thought for 4 seconds" style duration, based on measured milliseconds. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
