import type { Attendee } from "@shared/api-types";

/** 予定の、誰ができるかを決めるのに要るところ */
type EventAccess = { createdBy: string | null; attendees?: Pick<Attendee, "userId">[] };

/**
 * 予定を直せるか。作った人と、招待された人が直せる。返事が「参加しない」でも直せる。#28
 * 作った人が退会して分からない予定は、これまでどおりグループのメンバーなら誰でも直せる。
 * @param event 予定
 * @param userId 直そうとする人
 */
export function canEditEvent(event: EventAccess, userId: string): boolean {
  return (
    event.createdBy === null || event.createdBy === userId || (event.attendees ?? []).some((a) => a.userId === userId)
  );
}

/**
 * 予定を消せるか。作った人だけが消せる。招待された人は「参加しない」を返す。#28
 * 作った人が分からない予定は、グループのメンバーなら誰でも消せる。
 * @param event 予定
 * @param userId 消そうとする人
 */
export function canDeleteEvent(event: EventAccess, userId: string): boolean {
  return event.createdBy === null || event.createdBy === userId;
}

/**
 * 返事を返せるか。作った人を除く、招待された人だけ。#28
 * @param event 予定
 * @param userId 返そうとする人
 */
export function canRespond(event: EventAccess, userId: string): boolean {
  return event.createdBy !== userId && (event.attendees ?? []).some((a) => a.userId === userId);
}

/**
 * 招待した人に知らせるべきか。「参加する」に変わったときだけ知らせる。#32
 *
 * 前の返事が既に「参加する」なら、答え直しても知らせない。参加、不参加、参加と往復しても、
 * 作った人に届くお知らせは 1 件に保つ。作った人自身の返事や、「参加しない」への変化は、そもそも知らせない
 * @param response 新しい返事
 * @param previous 直す前の返事
 * @param createdBy 予定を作った人。分からなければ null
 * @param userId 返事をする人
 */
export function shouldNotifyAccepted(
  response: Attendee["response"],
  previous: Attendee["response"] | undefined,
  createdBy: string | null,
  userId: string,
): boolean {
  return response === "accepted" && previous !== "accepted" && createdBy !== null && createdBy !== userId;
}

/**
 * 招待する人を、送る形に整える。作った人と、重なりを除く。#28
 * @param ids 画面で選んだ人
 * @param createdBy 作った人。いつも参加者に入るので、送らない
 */
export function inviteeIds(ids: readonly string[], createdBy: string | null): string[] {
  return [...new Set(ids)].filter((id) => id !== createdBy);
}

/**
 * 直した後の参加者を決める。残る人の返事はそのまま、新しく招待した人は返事待ち、作った人はいつも参加する。#28
 * @param current いまの参加者
 * @param invitees 直した後に招待する人。作った人は含めなくてよい
 * @param createdBy 作った人。分からなければ null
 * @returns 残す人、足す人、外す人の ID
 */
export function diffAttendees(
  current: readonly Pick<Attendee, "userId">[],
  invitees: readonly string[],
  createdBy: string | null,
): { keep: string[]; add: string[]; remove: string[] } {
  const want = new Set(inviteeIds(invitees, createdBy));
  if (createdBy) want.add(createdBy);
  const have = new Set(current.map((a) => a.userId));
  return {
    keep: [...have].filter((id) => want.has(id)),
    add: [...want].filter((id) => !have.has(id)),
    remove: [...have].filter((id) => !want.has(id)),
  };
}
