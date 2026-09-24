import type { ClientExtension } from "@extensions/client/types";
import { BadgeJapaneseYen, Wallet } from "lucide-react";
import { kakeiboManifest } from "../manifest";
import { AssetsWidget, MonthTotalWidget, RecordHomeWidget, useMonthTotalHint } from "./HomeWidget";
import { KakeiboItemSheet } from "./KakeiboItemSheet";

/**
 * 家計簿の拡張の、画面の側。docs/logru/extensions/kakeibo/design.md
 * カレンダーの項目は日ごとの合計で、押すとその月の画面へ移すだけなので deleteItem は持たない。0047
 *
 * icon は、機能の一覧のカードと、カレンダーで金額を見分ける円のアイコンに使う。0056
 * 入口の nav.icon(Wallet)とは別に持ち、カレンダーでは常に円のアイコンで出す
 */
export const kakeiboClient: ClientExtension = {
  manifest: kakeiboManifest,
  Editor: KakeiboItemSheet,
  icon: BadgeJapaneseYen,
  nav: { label: "家計簿", icon: Wallet, path: "/kakeibo", description: "支出の記録と合計" },
  // 機能のシートには出さない。actions は「機能を足す」直後の案内だけに使う。ホームの記録するウィジェットと同じ道。0019
  actions: [{ label: "支出を記録する", icon: Wallet, path: "/kakeibo?record=1", hint: "金額とカテゴリ" }],
  useTileHint: useMonthTotalHint,
  widgets: [
    {
      key: "kakeibo.record",
      label: "支出を記録する",
      description: "支出を記録するシートを開きます。",
      defaultPlaced: true,
      Component: RecordHomeWidget,
    },
    {
      key: "kakeibo.total",
      label: "今月の合計",
      description: "使えるすべてのグループを合わせた、今月の支出の合計を表示します。",
      defaultPlaced: true,
      Component: MonthTotalWidget,
    },
    {
      key: "kakeibo.assets",
      label: "総資産",
      description: "自分の口座の残高の合計を表示します。口座が無ければ、口座を作る場所を表示します。",
      defaultPlaced: false,
      Component: AssetsWidget,
    },
  ],
  pages: [
    { path: "/kakeibo", load: async () => ({ Component: (await import("./KakeiboPage")).KakeiboPage }) },
    { path: "/kakeibo/accounts", load: async () => ({ Component: (await import("./AccountsPage")).AccountsPage }) },
    {
      path: "/kakeibo/accounts/:id",
      load: async () => ({ Component: (await import("./AccountRecordsPage")).AccountRecordsPage }),
    },
  ],
};
