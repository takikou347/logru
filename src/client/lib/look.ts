/**
 * ラボの「新しい見た目」で選ぶ、面の描き方。0090、F-43
 *
 * 選べるのは紙とリキッドガラス。既定はリキッドガラス。html の data-look に反映し、
 * tokens.css の `:root[data-lab-new-look][data-look="paper"]` がそのときだけ色や面を上書きする。
 * ラボの「新しい見た目」(`src/client/lib/lab.ts` の new-look)を切ると、data-look が
 * 残っていても tokens.css 側では何も上書きされない。選んだ値は端末ごと(localStorage)に持つ。
 */

import { useState } from "react";

export type Look = "glass" | "paper";

export const LOOKS: { value: Look; label: string; description: string }[] = [
  { value: "glass", label: "リキッドガラス", description: "奥を透かす面。いまの見た目に近い" },
  { value: "paper", label: "紙", description: "透かさず塗る、不透明な面" },
];

const KEY = "logru-look";

/** 端末に覚えさせた見た目を読む。読めないか、値がおかしければ既定のガラス */
export function readStoredLook(): Look {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "paper" || v === "glass") return v;
  } catch {
    // 読めなければ既定に戻す
  }
  return "glass";
}

/** html に見た目を反映し、端末にも覚えさせる */
export function applyLook(look: Look): void {
  document.documentElement.dataset.look = look;
  try {
    localStorage.setItem(KEY, look);
  } catch {
    // 保存できなくても、開いている画面の表示は変わる
  }
}

/** 設定の「テーマ」画面が使う、選んでいる見た目の状態。押した瞬間に画面へ効かせてから覚えさせる */
export function useStoredLook(): [Look, (look: Look) => void] {
  const [look, setLookState] = useState<Look>(readStoredLook);
  function setLook(next: Look) {
    applyLook(next);
    setLookState(next);
  }
  return [look, setLook];
}
