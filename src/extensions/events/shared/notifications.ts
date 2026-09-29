/**
 * 予定の拡張が積むお知らせの、文言と行き先。#32、0096、issue #245
 * ここは画面とサーバーの両方の tsconfig が読むので、client/types.ts の型は import しない。
 */

/**
 * その時刻を、Asia/Tokyo での `2026-09-20` の形にする。予定は端末の時間帯を持って積まないので、
 * 思い出の記録(0022、memories.like)と同じ割り切りで、まとめて Asia/Tokyo で出す。
 */
function dayKeyOfTokyo(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ms);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** タイトルが空でも「予定」で埋める */
function titleOf(payload: Record<string, unknown>): string {
  return typeof payload.title === "string" && payload.title ? payload.title : "予定";
}

/**
 * お知らせの kind と payload から、一覧の文言と押したときの行き先を作る。自分の拡張の kind でなければ null。
 *
 * - events.invite_accepted: 招待に「参加する」の返事があった。押すとその予定
 * - events.event_added / event_updated: 共有の予定が足された・変わった。押すとその予定
 * - events.event_deleted: 共有の予定が消された。予定はもう無いので、押すとその日
 */
export function describeEventNotification(
  kind: string,
  payload: Record<string, unknown>,
): { text: string; path: string } | null {
  const eventId = typeof payload.eventId === "string" ? payload.eventId : "";
  if (kind === "events.invite_accepted") {
    return { text: `「${titleOf(payload)}」に参加が決まりました。`, path: `/?openExt=events&openId=${eventId}` };
  }
  if (kind === "events.event_added") {
    return { text: `「${titleOf(payload)}」が予定に足されました。`, path: `/?openExt=events&openId=${eventId}` };
  }
  if (kind === "events.event_updated") {
    return { text: `「${titleOf(payload)}」の予定が変わりました。`, path: `/?openExt=events&openId=${eventId}` };
  }
  if (kind === "events.event_deleted") {
    const startsAt = typeof payload.startsAt === "number" ? payload.startsAt : Date.now();
    return {
      text: `「${titleOf(payload)}」の予定が消されました。`,
      path: `/?date=${dayKeyOfTokyo(startsAt)}&view=day`,
    };
  }
  return null;
}
