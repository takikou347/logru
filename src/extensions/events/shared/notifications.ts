/**
 * 予定の拡張が積むお知らせの、文言と行き先。#32
 * ここは画面とサーバーの両方の tsconfig が読むので、client/types.ts の型は import しない。
 */

/** 「参加する」が返ったときの通知だけ、文言と行き先に変える。ほかの kind は null */
export function describeEventNotification(
  kind: string,
  payload: Record<string, unknown>,
): { text: string; path: string } | null {
  if (kind !== "events.invite_accepted") return null;
  const title = typeof payload.title === "string" && payload.title ? payload.title : "予定";
  const eventId = typeof payload.eventId === "string" ? payload.eventId : "";
  return { text: `「${title}」に参加が決まりました。`, path: `/?openExt=events&openId=${eventId}` };
}
