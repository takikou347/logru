import type { ServerExtension } from "@extensions/server/types";
import { externalCalendarsManifest } from "../manifest";
import { listExternalEvents, searchExternalEvents } from "./provider";
import { externalCalendarRoutes } from "./routes";
import * as schema from "./schema";
import { syncDueCalendars } from "./sync";

/** 外部のカレンダーの拡張のサーバー側 */
export const externalCalendarsServer: ServerExtension = {
  manifest: externalCalendarsManifest,
  schema,
  listCalendarItems: listExternalEvents,
  search: searchExternalEvents,
  routes: { basePath: "/external-calendars", router: externalCalendarRoutes },
  scheduled: syncDueCalendars,
};
