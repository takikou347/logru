import type { ClientExtension } from "@extensions/client/types";
import { CloudSun } from "lucide-react";
import { weatherManifest } from "../manifest";
import { WeatherItemSheet } from "./WeatherItemSheet";
import { WeatherSettingsSection } from "./WeatherSettingsSection";

/** 天気の拡張の、画面の側。読むだけなので deleteItem は持たない。nav を持たないので、設定の一覧には icon を渡す。#113 */
export const weatherClient: ClientExtension = {
  manifest: weatherManifest,
  Editor: WeatherItemSheet,
  SettingsSection: WeatherSettingsSection,
  icon: CloudSun,
};
