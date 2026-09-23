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
 *
 * この types.ts は画面とサーバーの両方の tsconfig が読むので、両方で使える型だけを置く。
 * サーバーだけの型は types.server.ts に、画面だけの型は types.client.ts にある。
 */

import type { TourStep } from "@shared/tours";

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
  /**
   * この拡張が土台の notify() で積む、お知らせの kind の一覧。`<この key>.<名前>` の形。#32
   * `/api/notifications/unread-count` は、ここに載っている kind だけを数える。
   * 画面の describeNotification が出せない kind を数えて、一覧は空なのに数字が出ることを防ぐ
   */
  notificationKinds?: string[];
  /**
   * 拡張の画面を初めて開いたときに出す案内。1 枚から 3 枚。F-33
   * 無ければ案内は出ない。見たかは `ext.<この key>` の ID で持つ
   */
  tour?: TourStep[];
};
