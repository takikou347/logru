import type { ClientExtension } from "@extensions/client/types";
import { CalendarSync } from "lucide-react";
import { externalCalendarsManifest } from "../manifest";
import { refreshExternalCalendars } from "./api";
import { ExternalCalendarsSection } from "./ExternalCalendarsSection";
import { ExternalEventSheet } from "./ExternalEventSheet";

/** 外部のカレンダーの拡張の、画面の側。読むだけなので deleteItem は持たない。nav を持たないので、設定の一覧には icon を渡す */
export const externalCalendarsClient: ClientExtension = {
  manifest: externalCalendarsManifest,
  Editor: ExternalEventSheet,
  SettingsSection: ExternalCalendarsSection,
  icon: CalendarSync,
  refresh: refreshExternalCalendars,
};
