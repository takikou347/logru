/**
 * ラボ。`要確認` の見た目を staging と手元の開発だけで試す仕組み。0038、0039、F-35
 *
 * 試す見た目は LAB_EXPERIMENTS に 1 件足すだけでよい。設定の「ラボ」の欄に入り切りの行が並ぶ。
 * 入り切りは端末の localStorage に持ち、既定は切。欄そのものは GET /api/me の showLab が
 * true のときだけ出す。showLab が false のとき(本番)は useApplyLabExperiments も何もしない。
 */

import { useEffect } from "react";

export type LabExperiment = {
  key: string;
  label: string;
  description: string;
  /** 入れたときと切ったときに呼ぶ。見た目や動きを変える処理をここに書く */
  apply: (enabled: boolean) => void;
};

/**
 * 仕組みを確かめるための見本。見た目は変えず、html タグに data-lab-sample-marker を付けるだけ。
 * 実際の見た目を試すときは、この 1 件と同じ形で足す
 */
const SAMPLE_EXPERIMENT: LabExperiment = {
  key: "sample-marker",
  label: "見本: 開発の印",
  description: "ラボの仕組みを確かめるための見本です。見た目は変わりません",
  apply: (enabled) => {
    document.documentElement.toggleAttribute("data-lab-sample-marker", enabled);
  },
};

/**
 * 月送りを、日めくりの 3D の代わりに、横に滑るだけの動きにする。既定は 3D の日めくり。#99、0049
 * MonthFlipDeck は、めくり始めるたびにこの属性の有無を読み直す
 */
const MONTH_SLIDE_EXPERIMENT: LabExperiment = {
  key: "month-slide",
  label: "月送り: 横に滑るだけ",
  description: "月を送るとき、3D の日めくりの代わりに、横に滑るだけの動きにします。",
  apply: (enabled) => {
    document.documentElement.toggleAttribute("data-lab-month-slide", enabled);
  },
};

/** 試している見た目。足すのはここへ 1 件 */
export const LAB_EXPERIMENTS: LabExperiment[] = [SAMPLE_EXPERIMENT, MONTH_SLIDE_EXPERIMENT];

const PREFIX = "logru:lab:";

/** ある見た目が入っているか。読めなければ既定の切 */
export function isLabEnabled(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

/** ある見た目の入り切りを変える。保存できなくても、開いている画面には効く */
export function setLabEnabled(key: string, enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(PREFIX + key, "1");
    else localStorage.removeItem(PREFIX + key);
  } catch {
    // 保存できない環境では、次に開いたときに既定の切へ戻る
  }
}

/**
 * 登録した見た目を、いまの入り切りに合わせて掛け直す。認証済みの画面の枠から呼ぶ。
 * @param showLab GET /api/me の showLab。false の間(本番)は localStorage も読まない
 */
export function useApplyLabExperiments(showLab: boolean | undefined): void {
  useEffect(() => {
    if (!showLab) return;
    for (const ex of LAB_EXPERIMENTS) ex.apply(isLabEnabled(ex.key));
  }, [showLab]);
}
