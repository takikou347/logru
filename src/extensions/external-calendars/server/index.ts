import type { ServerExtension } from "../../types";
import { externalCalendarsManifest } from "../manifest";
import { listExternalEvents } from "./provider";
import { externalCalendarRoutes } from "./routes";
import * as schema from "./schema";
import { syncDueCalendars } from "./sync";

/** 外部のカレンダーの拡張のサーバー側 */
export const externalCalendarsServer: ServerExtension = {
  manifest: externalCalendarsManifest,
  schema,
  listCalendarItems: listExternalEvents as ServerExtension["listCalendarItems"],
  routes: { basePath: "/external-calendars", router: externalCalendarRoutes as never },
  scheduled: syncDueCalendars as ServerExtension["scheduled"],
};
