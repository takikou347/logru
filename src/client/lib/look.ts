/**
 * ラボの「新しい見た目」で選ぶ、面の描き方。0090、0095、F-43
 *
 * 選べるのは紙・リキッドガラス・水・夜空・木・季節の 6 つ。既定はリキッドガラス。html の
 * data-look に反映し、tokens.css の `:root[data-lab-new-look][data-look="..."]` がそのときだけ
 * 色や面を上書きする。ラボの「新しい見た目」(`src/client/lib/lab.ts` の new-look)を切ると、
 * data-look が残っていても tokens.css 側では何も上書きされない。選んだ値は端末ごと
 * (localStorage)に持つ。
 */

import { useState } from "react";

export type Look = "glass" | "paper" | "water" | "night" | "wood" | "season";

const LOOK_VALUES: Look[] = ["glass", "paper", "water", "night", "wood", "season"];

export const LOOKS: { value: Look; label: string; description: string }[] = [
  { value: "glass", label: "リキッドガラス", description: "奥を透かす面。いまの見た目に近い" },
  { value: "paper", label: "紙", description: "透かさず塗る、不透明な面" },
  { value: "water", label: "水", description: "水の中から見上げた、揺らぐ光" },
  { value: "night", label: "夜空", description: "星の散らばる、深い藍の空" },
  { value: "wood", label: "木", description: "木の板と、紙の日めくり" },
  { value: "season", label: "季節", description: "開くたびに今の季節の色(春夏秋冬)" },
];

const KEY = "logru-look";

/** 端末に覚えさせた見た目を読む。読めないか、値がおかしければ既定のガラス */
export function readStoredLook(): Look {
  try {
    const v = localStorage.getItem(KEY);
    if (isLook(v)) return v;
  } catch {
    // 読めなければ既定に戻す
  }
  return "glass";
}

function isLook(v: unknown): v is Look {
  return typeof v === "string" && (LOOK_VALUES as string[]).includes(v);
}

/**
 * 日本時間の月から、季節のテーマの季節を決める。3〜5 春、6〜8 夏、9〜11 秋、12〜2 冬。0095
 * E2E は `page.clock` で日時を止めて確かめる(`Date` を差し替えるので、ここでの計算もそのまま従う)。
 */
export type Season = "spring" | "summer" | "autumn" | "winter";

export function currentSeason(): Season {
  const month = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(new Date()),
  );
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/**
 * html に見た目を反映し、端末にも覚えさせる。季節([data-season])は look が season のときだけ
 * 意味を持つが、いつ切り替えても正しい値になるよう毎回計算して置いておく
 */
export function applyLook(look: Look): void {
  document.documentElement.dataset.look = look;
  document.documentElement.dataset.season = currentSeason();
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
