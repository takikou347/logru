import type { ExtensionManifest } from "../types";

/** 天気。いつもの場所の 7 日分の予報を、カレンダーと思い出の日に出す。#113 */
export const weatherManifest: ExtensionManifest = {
  key: "weather",
  label: "天気",
  description: "いつもの場所の天気を、カレンダーと思い出の日に出す",
  alwaysOn: true,
  perUser: true,
};
