import type { ExtensionManifest } from "../types";

/** 共有リスト。買い物や持ち物を、グループで 1 つのリストとして持つ。最初の版は小さく作る。0054、issue #108 */
export const listsManifest: ExtensionManifest = {
  key: "lists",
  label: "リスト",
  description: "買い物や持ち物を、グループで共有するチェックリスト",
  alwaysOn: false,
  tour: [
    {
      target: '[aria-label="項目を足す"]',
      text: "上の欄に打って Enter か「足す」で項目を足せます。項目は左へスワイプすると、直す・消すができます。",
    },
  ],
};
