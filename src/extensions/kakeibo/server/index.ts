import type { ServerExtension } from "@extensions/server/types";
import { kakeiboManifest } from "../manifest";
import { listKakeiboItems } from "./provider";
import { kakeiboRoutes } from "./routes";
import * as schema from "./schema";

/**
 * 家計簿の拡張のサーバー側。0047
 * グループを抜けても記録は残す。作った人の列だけが空になり、その記録は誰も直せなくなる。困ることに書いている
 */
export const kakeiboServer: ServerExtension = {
  manifest: kakeiboManifest,
  schema,
  listCalendarItems: listKakeiboItems,
  routes: { basePath: "/kakeibo", router: kakeiboRoutes },
};
