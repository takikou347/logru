import type { ExtensionManifest } from "../types";

/** 外部のカレンダー。Google カレンダーなどの予定を、非公開の iCal の URL から読んで出す */
export const externalCalendarsManifest: ExtensionManifest = {
  key: "external",
  label: "外部のカレンダー",
  description: "Google カレンダーなどの予定を、読むだけで取り込む",
  alwaysOn: true,
  perUser: true,
};
