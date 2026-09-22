/**
 * 拡張が守る約束のうち、サーバーだけが使う型。画面とサーバーの両方が使う型は types.ts にある。
 *
 * この types.server.ts は tsconfig.worker.json だけが読む。DB、Env、Hono<AppEnv> をそのまま使ってよい。
 */

import type { AppEnv } from "@server/core/app";
import type { DB } from "@server/core/db/client";
import type { CalendarItem } from "@shared/api-types";
import type { Hono } from "hono";
import type { ExtensionManifest } from "../types";

/** 項目を呼ぶ人。利用者ごとの拡張が、本人の項目だけを返すのに使う */
export type CalendarContext = { userId: string };

/**
 * カレンダーに項目を渡す口。カレンダーは拡張の中身を知らず、これを呼ぶだけ。
 * @param db D1 を包んだ Drizzle
 * @param groupIds 呼んでよいグループ。利用者が入っていて、この拡張が有効なものだけ
 * @param from 期間の始まり。ミリ秒の UTC
 * @param to 期間の終わり。この時刻を含まない
 * @param ctx 項目を呼ぶ人
 */
export type ListCalendarItems = (
  db: DB,
  groupIds: string[],
  from: number,
  to: number,
  ctx: CalendarContext,
) => Promise<CalendarItem[]>;

/**
 * Cron Triggers で定期的に呼ぶ処理。
 * @param db D1 を包んだ Drizzle
 * @param env Worker の環境変数
 */
export type ScheduledTask = (db: DB, env: Env) => Promise<void>;

/**
 * 人がグループを抜けたときに呼ぶ処理。その人に結び付けた、そのグループのデータを片付ける。#28
 * グループの行も、メンバーの行も、呼んだ時点ではまだ消していない。
 * @param db D1 を包んだ Drizzle
 * @param groupId 抜けるグループ
 * @param userId 抜ける人
 */
export type MemberLeaveTask = (db: DB, groupId: string, userId: string) => Promise<void>;

/** サーバー側の拡張 */
export type ServerExtension = {
  manifest: ExtensionManifest;
  /** Drizzle の表の定義。db/client.ts がまとめて読み込む */
  schema: Record<string, unknown>;
  listCalendarItems: ListCalendarItems;
  /** `/api/<basePath>` に載せる API。無ければ省く */
  routes?: { basePath: string; router: Hono<AppEnv> };
  /** 定期的に呼ぶ処理。無ければ省く */
  scheduled?: ScheduledTask;
  /** 人がグループを抜けたときの片付け。無ければ省く。予定の拡張は、その人を予定の参加者から外す */
  onMemberLeave?: MemberLeaveTask;
};
