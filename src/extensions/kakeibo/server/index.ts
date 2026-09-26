import type { ServerExtension } from "@extensions/server/types";
import { kakeiboManifest } from "../manifest";
import { listKakeiboItems, searchKakeibo } from "./provider";
import { kakeiboRoutes } from "./routes";
import { insertDueRecurringRecords, pauseRecurringsForLeaver } from "./scheduled";
import * as schema from "./schema";

/**
 * 家計簿の拡張のサーバー側。0047
 * グループを抜けても記録は残す。作った人の列だけが空になり、その記録は誰も直せなくなる。困ることに書いている
 */
export const kakeiboServer: ServerExtension = {
  manifest: kakeiboManifest,
  schema,
  listCalendarItems: listKakeiboItems,
  search: searchKakeibo,
  routes: { basePath: "/kakeibo", router: kakeiboRoutes },
  // 5 分おきの Cron から呼ばれる。決めた日になった定期の記録を入れる。0072、F-325
  scheduled: (db) => insertDueRecurringRecords(db),
  // 抜けた人が作った、そのグループの定期の記録を止める。次の処理で入らなくなる。#198、0076
  onMemberLeave: pauseRecurringsForLeaver,
};
