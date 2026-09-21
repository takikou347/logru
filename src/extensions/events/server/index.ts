import type { ServerExtension } from "../../types";
import { eventsManifest } from "../manifest";
import { listEvents } from "./provider";
import { eventRoutes } from "./routes";
import * as schema from "./schema";

/** 予定の拡張のサーバー側 */
export const eventsServer: ServerExtension = {
  manifest: eventsManifest,
  schema,
  listCalendarItems: listEvents as ServerExtension["listCalendarItems"],
  routes: { basePath: "/events", router: eventRoutes as never },
};
