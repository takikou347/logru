/**
 * 思い出の拡張が積むお知らせの、文言と行き先。F-116、#32
 * ここは画面とサーバーの両方の tsconfig が読むので、client/types.ts の型は import しない。
 */
import { dayKeyIn } from "./days";

/**
 * いいねの通知だけ、文言と行き先に変える。押した先は記録があった日の一覧。ほかの kind は null。
 * 日付は端末の時間帯までは持たないので、まとめて Asia/Tokyo で出す。0022 の記録と同じ割り切り
 */
export function describeMemoriesNotification(
  kind: string,
  payload: Record<string, unknown>,
): { text: string; path: string } | null {
  if (kind !== "memories.like") return null;
  const occurredAt = typeof payload.occurredAt === "number" ? payload.occurredAt : Date.now();
  return { text: "記録にいいねが付きました。", path: `/memories/on/${dayKeyIn(occurredAt, "Asia/Tokyo")}` };
}
