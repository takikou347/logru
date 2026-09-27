import type { ClientExtension, DayItem } from "@extensions/client/types";
import { CloudSun } from "lucide-react";
import { weatherManifest } from "../manifest";
import { WeatherItemSheet } from "./WeatherItemSheet";
import { WeatherSettingsSection } from "./WeatherSettingsSection";

/**
 * 今日のページの見出しの1行。その日の天気の項目の題名(例「晴れ 26°/18°」)をそのまま使う。
 * カレンダーの項目を天気の拡張が自分で作るときに、すでに読みやすい題名にしているため。0092、issue #240
 */
function useHeadline(_enabled: boolean, _date: Date, dayItems: DayItem[]): string | null {
  return dayItems[0]?.title ?? null;
}

/** 天気の拡張の、画面の側。読むだけなので deleteItem は持たない。nav を持たないので、設定の一覧には icon を渡す。#113 */
export const weatherClient: ClientExtension = {
  manifest: weatherManifest,
  Editor: WeatherItemSheet,
  SettingsSection: WeatherSettingsSection,
  icon: CloudSun,
  useHeadline,
};
