/**
 * 家計簿の拡張が積むお知らせの、文言と行き先。0096、issue #246
 * ここは画面とサーバーの両方の tsconfig が読むので、client/types.ts の型は import しない。
 */
import { formatYen } from "./format";

/** 「みかが IKEA ¥12,980 を立て替えました」のように、名前と品目と金額を出す */
function itemLabel(payload: Record<string, unknown>): string {
  return typeof payload.name === "string" && payload.name ? payload.name : "支出";
}

function byUserNameOf(payload: Record<string, unknown>): string {
  return typeof payload.byUserName === "string" ? payload.byUserName : "";
}

/**
 * お知らせの kind と payload から、一覧の文言と押したときの行き先を作る。自分の拡張の kind でなければ null。
 *
 * - kakeibo.expense_shared: 立て替えられた。金額と自分の負担額を出す。押すとその記録
 * - kakeibo.settled: 精算したと記録された。押すと精算の面
 * - kakeibo.recurring_posted: 定期の記録が入った。押すとその記録。同じ日はまとめて件数を出す
 * - kakeibo.budget_exceeded: 予算を超えた。押すと予算の画面
 */
export function describeKakeiboNotification(
  kind: string,
  payload: Record<string, unknown>,
): { text: string; path: string } | null {
  const month = typeof payload.month === "string" ? payload.month : "";
  const group = typeof payload.groupId === "string" ? payload.groupId : "";
  if (kind === "kakeibo.expense_shared") {
    const amount = typeof payload.amount === "number" ? payload.amount : 0;
    const share = typeof payload.share === "number" ? payload.share : 0;
    const id = typeof payload.expenseId === "string" ? payload.expenseId : "";
    return {
      text: `${byUserNameOf(payload)}が ${itemLabel(payload)} ${formatYen(amount)} を立て替えました。あなたの負担 ${formatYen(share)}`,
      path: `/kakeibo?month=${month}&group=${group}&edit=${id}`,
    };
  }
  if (kind === "kakeibo.settled") {
    const amount = typeof payload.amount === "number" ? payload.amount : 0;
    return {
      text: `${byUserNameOf(payload)}が ${formatYen(amount)} を精算したと記録しました。`,
      path: `/kakeibo?group=${group}#kakeibo-settlement`,
    };
  }
  if (kind === "kakeibo.recurring_posted") {
    const n = typeof payload.count === "number" && payload.count > 0 ? payload.count : 1;
    const id = typeof payload.expenseId === "string" ? payload.expenseId : "";
    const text = n > 1 ? `定期の記録が ${n} 件入りました。` : "定期の記録が入りました。";
    return { text, path: `/kakeibo?month=${month}&group=${group}&edit=${id}` };
  }
  if (kind === "kakeibo.budget_exceeded") {
    const name = typeof payload.name === "string" && payload.name ? payload.name : "予算";
    return { text: `予算「${name}」を超えました。`, path: `/kakeibo/budgets?group=${group}` };
  }
  return null;
}
