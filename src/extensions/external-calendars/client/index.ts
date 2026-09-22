import type { ClientExtension } from "@extensions/client/types";
import { externalCalendarsManifest } from "../manifest";
import { ExternalCalendarsSection } from "./ExternalCalendarsSection";
import { ExternalEventSheet } from "./ExternalEventSheet";
import { refreshExternalCalendars } from "./api";

/** 外部のカレンダーの拡張の、画面の側。読むだけなので deleteItem は持たない */
export const externalCalendarsClient: ClientExtension = {
  manifest: externalCalendarsManifest,
  Editor: ExternalEventSheet,
  SettingsSection: ExternalCalendarsSection,
  refresh: refreshExternalCalendars,
};
