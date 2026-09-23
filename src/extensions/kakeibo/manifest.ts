import type { ExtensionManifest } from "../types";

/** 家計簿。支出の記録とカテゴリ別の合計。最初の版は小さく作る。0047 */
export const kakeiboManifest: ExtensionManifest = {
  key: "kakeibo",
  label: "家計簿",
  description: "支出を記録して、月ごとの合計を見る",
  alwaysOn: false,
};
