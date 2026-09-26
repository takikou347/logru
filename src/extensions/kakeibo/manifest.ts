import type { ExtensionManifest } from "../types";

/** 家計簿。口座を持ち、支出・収入・振替を記録する。ふつうの家計簿として使える形にする。0069 */
export const kakeiboManifest: ExtensionManifest = {
  key: "kakeibo",
  label: "家計簿",
  description: "支出・収入・振替を記録して、口座と総資産を見る",
  alwaysOn: false,
};
