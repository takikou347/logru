import type { ServerExtension } from "../../types";
import { memoriesManifest } from "../manifest";
import { listMemoryItems } from "./provider";
import { memoryRoutes } from "./routes";
import { cleanUpPhotos } from "./scheduled";
import * as schema from "./schema";

/**
 * 思い出の拡張のサーバー側。
 * グループを抜けた人の記録は、グループの記録として残す。片付けるものは無い。
 */
export const memoriesServer: ServerExtension = {
  manifest: memoriesManifest,
  schema,
  listCalendarItems: listMemoryItems as ServerExtension["listCalendarItems"],
  routes: { basePath: "/memories", router: memoryRoutes as never },
  scheduled: cleanUpPhotos as ServerExtension["scheduled"],
};
