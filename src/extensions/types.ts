/**
 * 拡張が守る約束。0002 と 0008 で決めた形。
 *
 * 拡張は src/extensions/<名前>/ の中に閉じる。
 * - manifest.ts: 名前と説明。画面とサーバーの両方が読む
 * - server/: 表の定義、カレンダーへの項目の渡し方、API
 * - client/: 画面の部品
 * - shared/: 入力の検証など、画面とサーバーの両方で使うもの
 *
 * 足すときは registry.server.ts と registry.client.ts に 1 行ずつ足す。
 */
import type { Hono } from "hono";
import type { CalendarItem } from "../shared/api-types";

/** 拡張の名前と説明。画面のグループ設定に出る */
export type ExtensionManifest = {
  /** 拡張を見分ける名前。英小文字。group_extensions.extension_key と CalendarItem.extension に入る */
  key: string;
  label: string;
  description: string;
  /** true なら切り替えの対象にせず、いつも有効にする。予定と外部のカレンダー */
  alwaysOn: boolean;
  /**
   * 利用者ごとの拡張なら true。グループの設定の切り替えに出さない。
   * 項目は登録した本人にだけ、その人の自分だけのグループの項目として出す
   */
  perUser?: boolean;
};

/** 項目を呼ぶ人。利用者ごとの拡張が、本人の項目だけを返すのに使う */
export type CalendarContext = { userId: string };

/**
 * カレンダーに項目を渡す口。カレンダーは拡張の中身を知らず、これを呼ぶだけ。
 * @param db D1 を包んだ Drizzle。型は循環を避けるため unknown で受け、拡張の中で絞る
 * @param groupIds 呼んでよいグループ。利用者が入っていて、この拡張が有効なものだけ
 * @param from 期間の始まり。ミリ秒の UTC
 * @param to 期間の終わり。この時刻を含まない
 * @param ctx 項目を呼ぶ人
 */
export type ListCalendarItems = (
  db: never,
  groupIds: string[],
  from: number,
  to: number,
  ctx: CalendarContext,
) => Promise<CalendarItem[]>;

/**
 * Cron Triggers で定期的に呼ぶ処理。
 * @param db D1 を包んだ Drizzle。listCalendarItems と同じく never で受ける
 * @param env Worker の環境変数。型は画面の側でも読めるよう never で受け、拡張の中で絞る
 */
export type ScheduledTask = (db: never, env: never) => Promise<void>;

/** サーバー側の拡張 */
export type ServerExtension = {
  manifest: ExtensionManifest;
  /** Drizzle の表の定義。db/client.ts がまとめて読み込む */
  schema: Record<string, unknown>;
  listCalendarItems: ListCalendarItems;
  /** `/api/<basePath>` に載せる API。無ければ省く */
  routes?: { basePath: string; router: Hono<never> };
  /** 定期的に呼ぶ処理。無ければ省く */
  scheduled?: ScheduledTask;
};
