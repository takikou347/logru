import type { ClientExtension } from "../../types.client";
import { externalCalendarsManifest } from "../manifest";
import { ExternalCalendarsSection } from "./ExternalCalendarsSection";
import { ExternalEventSheet } from "./ExternalEventSheet";
import { ExternalRefreshButton } from "./ExternalRefreshButton";

/** 外部のカレンダーの拡張の、画面の側。読むだけなので deleteItem は持たない */
export const externalCalendarsClient: ClientExtension = {
  manifest: externalCalendarsManifest,
  Editor: ExternalEventSheet,
  SettingsSection: ExternalCalendarsSection,
  CalendarAction: ExternalRefreshButton,
};
