/**
 * 思い出の拡張が積むお知らせの、文言と行き先。F-116、#32、0096、issue #244、#247
 * ここは画面とサーバーの両方の tsconfig が読むので、client/types.ts の型は import しない。
 */
import { dayKeyIn } from "./days";

/** 積み重ねた件数。無ければ 1 件 */
function countOf(payload: Record<string, unknown>): number {
  return typeof payload.count === "number" && payload.count > 0 ? payload.count : 1;
}

/**
 * しおりの担当になったことを積むか。新しく決まった担当が居て、前の担当と違うときだけ。
 * 自分を選んだときも積む対象にする(notify() の actorId で自分には除かれる)。0096、issue #247
 * @param assigneeId 送られてきた担当。undefined なら送られていない(直さない)
 * @param previousAssigneeId 直す前の担当。作るときは null
 */
export function shouldNotifyShioriAssignment(
  assigneeId: string | null | undefined,
  previousAssigneeId: string | null,
): assigneeId is string {
  return Boolean(assigneeId) && assigneeId !== previousAssigneeId;
}

/**
 * お知らせの kind と payload から、一覧の文言と押したときの行き先を作る。自分の拡張の kind でなければ null。
 * 日付は端末の時間帯までは持たないので、まとめて Asia/Tokyo で出す。0022 の記録と同じ割り切り
 *
 * - memories.like: 記録にいいねが付いた。押すと記録があった日の一覧。まとめると件数を出す
 * - memories.koma_slot: ひとコマの時刻になった。押すといまのひとコマ
 * - memories.record_added: 思い出に記録・写真が足された。押すとその日の一覧。まとめると件数を出す
 * - memories.shiori_assigned: しおりの担当になった。押すとそのしおり
 */
export function describeMemoriesNotification(
  kind: string,
  payload: Record<string, unknown>,
): { text: string; path: string } | null {
  if (kind === "memories.like") {
    const occurredAt = typeof payload.occurredAt === "number" ? payload.occurredAt : Date.now();
    const n = countOf(payload);
    const text = n > 1 ? `記録にいいねが ${n} 件付きました。` : "記録にいいねが付きました。";
    return { text, path: `/memories/on/${dayKeyIn(occurredAt, "Asia/Tokyo")}` };
  }
  if (kind === "memories.koma_slot") {
    const hour = typeof payload.hour === "number" ? payload.hour : undefined;
    return {
      text: hour != null ? `${hour} 時のひとコマを撮りましょう。` : "ひとコマの時刻になりました。",
      path: "/memories/koma/now",
    };
  }
  if (kind === "memories.record_added") {
    const occurredAt = typeof payload.occurredAt === "number" ? payload.occurredAt : Date.now();
    const byUserName = typeof payload.byUserName === "string" ? payload.byUserName : "";
    const n = countOf(payload);
    const text =
      n > 1
        ? `${byUserName ? `${byUserName}が` : ""}記録・写真を ${n} 件足しました。`
        : `${byUserName ? `${byUserName}が` : ""}記録・写真を足しました。`;
    return { text, path: `/memories/on/${dayKeyIn(occurredAt, "Asia/Tokyo")}` };
  }
  if (kind === "memories.shiori_assigned") {
    const memoryId = typeof payload.memoryId === "string" ? payload.memoryId : "";
    const title = typeof payload.title === "string" && payload.title ? payload.title : "しおり";
    return { text: `「${title}」の担当になりました。`, path: `/memories/${memoryId}/shiori` };
  }
  return null;
}
