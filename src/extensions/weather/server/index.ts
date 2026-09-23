import type { ServerExtension } from "@extensions/server/types";
import { weatherManifest } from "../manifest";
import { listWeatherItems, searchWeather } from "./provider";
import { weatherRoutes } from "./routes";
import { refreshDueLocations } from "./scheduled";
import * as schema from "./schema";

/** 天気の拡張のサーバー側。#113 */
export const weatherServer: ServerExtension = {
  manifest: weatherManifest,
  schema,
  listCalendarItems: listWeatherItems,
  search: searchWeather,
  routes: { basePath: "/weather", router: weatherRoutes },
  scheduled: refreshDueLocations,
};
