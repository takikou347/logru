import type { ServerExtension } from "@extensions/server/types";
import { listsManifest } from "../manifest";
import { listListItems, searchLists } from "./provider";
import { listsRoutes } from "./routes";
import * as schema from "./schema";

/**
 * 共有リストの拡張のサーバー側。0054
 * グループを抜けても、リストと項目は残る。作った人の列だけが空になる
 */
export const listsServer: ServerExtension = {
  manifest: listsManifest,
  schema,
  listCalendarItems: listListItems,
  search: searchLists,
  routes: { basePath: "/lists", router: listsRoutes },
};
