/**
 * 記録のシートの、前回の選択をこの端末に覚えさせる。0069、F-314
 *
 * サーバーには持たない、消えても困らない値。プライベートモードなど書き込めない端末でも
 * 記録自体は続けられるよう、読み書きは try/catch で包む。グループの絞り込み(F-20)や
 * 種類の入り切り(0056)と同じ考え方
 */
import { KAKEIBO_TYPES, type KakeiboType } from "../shared/types";

const KEY = "logru-kakeibo-last-record";

/** 前回、記録のシートで選んでいたもの */
export type KakeiboLastRecord = {
  type: KakeiboType;
  accountId: string | null;
  toAccountId: string | null;
  groupId: string | null;
};

const RECORD_TYPES = new Set<string>(KAKEIBO_TYPES);

/** 文字列か null。それ以外の形(数値、真偽など)なら null にする */
function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * 読めなければ null。値の形が壊れていても null にする。
 * 端末に残った古い形や、書き換えられた値をそのまま信じない。項目ごとに型を確かめる。#193
 */
export function loadLastRecord(): KakeiboLastRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (typeof v.type !== "string" || !RECORD_TYPES.has(v.type)) return null;
    return {
      type: v.type as KakeiboLastRecord["type"],
      accountId: stringOrNull(v.accountId),
      toAccountId: stringOrNull(v.toAccountId),
      groupId: stringOrNull(v.groupId),
    };
  } catch {
    return null;
  }
}

/** 保存する。書き込めなくても、いまの画面での記録は続けられる */
export function saveLastRecord(value: KakeiboLastRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 覚えられなくても、次回は既定(支出、口座なし)に戻るだけ
  }
}

/**
 * カテゴリごとに前回使った口座。表を持たず、端末が覚える。0072、F-327
 * カテゴリを選ぶとその口座が選ばれる。口座を手で選んだら、そちらを使う(呼び出し側で上書きする)
 */
const CATEGORY_ACCOUNT_KEY = "logru-kakeibo-category-account";

/** そのカテゴリで前回使った口座。覚えていなければ null */
export function loadCategoryAccount(category: string): string | null {
  try {
    const raw = localStorage.getItem(CATEGORY_ACCOUNT_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as unknown;
    if (!map || typeof map !== "object") return null;
    const value = (map as Record<string, unknown>)[category];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/** カテゴリごとの前回の口座を覚える。口座なしを選んだら、そのカテゴリの分は忘れる */
export function saveCategoryAccount(category: string, accountId: string | null): void {
  try {
    const raw = localStorage.getItem(CATEGORY_ACCOUNT_KEY);
    const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (accountId) map[category] = accountId;
    else delete map[category];
    localStorage.setItem(CATEGORY_ACCOUNT_KEY, JSON.stringify(map));
  } catch {
    // 覚えられなくても、次回はそのカテゴリの口座が選ばれないだけ
  }
}
