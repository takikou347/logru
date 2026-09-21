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
  /** 予定だけ true。切り替えの対象にせず、いつも有効にする */
  alwaysOn: boolean;
};

/**
 * カレンダーに項目を渡す口。カレンダーは拡張の中身を知らず、これを呼ぶだけ。
 * @param db D1 を包んだ Drizzle。型は循環を避けるため unknown で受け、拡張の中で絞る
 * @param groupIds 呼んでよいグループ。利用者が入っていて、この拡張が有効なものだけ
 * @param from 期間の始まり。ミリ秒の UTC
 * @param to 期間の終わり。この時刻を含まない
 */
export type ListCalendarItems = (db: never, groupIds: string[], from: number, to: number) => Promise<CalendarItem[]>;

/** サーバー側の拡張 */
export type ServerExtension = {
  manifest: ExtensionManifest;
  /** Drizzle の表の定義。db/client.ts がまとめて読み込む */
  schema: Record<string, unknown>;
  listCalendarItems: ListCalendarItems;
  /** `/api/<basePath>` に載せる API。無ければ省く */
  routes?: { basePath: string; router: Hono<never> };
};
