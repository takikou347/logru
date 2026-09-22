import type { ServerExtension } from "@extensions/server/types";
import { eventsManifest } from "../manifest";
import { removeFromGroupEvents } from "./leave";
import { listEvents } from "./provider";
import { eventRoutes } from "./routes";
import * as schema from "./schema";

/** 予定の拡張のサーバー側 */
export const eventsServer: ServerExtension = {
  manifest: eventsManifest,
  schema,
  listCalendarItems: listEvents,
  routes: { basePath: "/events", router: eventRoutes },
  onMemberLeave: removeFromGroupEvents,
};
