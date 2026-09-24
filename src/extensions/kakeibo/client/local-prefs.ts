/**
 * 記録のシートの、前回の選択をこの端末に覚えさせる。0069、F-314
 *
 * サーバーには持たない、消えても困らない値。プライベートモードなど書き込めない端末でも
 * 記録自体は続けられるよう、読み書きは try/catch で包む。グループの絞り込み(F-20)や
 * 種類の入り切り(0056)と同じ考え方
 */
import type { KakeiboType } from "../shared/types";

const KEY = "logru-kakeibo-last-record";

/** 前回、記録のシートで選んでいたもの */
export type KakeiboLastRecord = {
  type: KakeiboType;
  accountId: string | null;
  toAccountId: string | null;
  groupId: string | null;
};

/** 読めなければ null。値の形が壊れていても null にする */
export function loadLastRecord(): KakeiboLastRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    return value as KakeiboLastRecord;
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
