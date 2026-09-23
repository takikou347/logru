import type { ClientExtension } from "@extensions/client/types";
import { Wallet } from "lucide-react";
import { kakeiboManifest } from "../manifest";
import { MonthTotalWidget, RecordHomeWidget } from "./HomeWidget";
import { KakeiboItemSheet } from "./KakeiboItemSheet";

/**
 * 家計簿の拡張の、画面の側。docs/logru/extensions/kakeibo/design.md
 * カレンダーの項目は日ごとの合計で、押すとその月の画面へ移すだけなので deleteItem は持たない。0047
 */
export const kakeiboClient: ClientExtension = {
  manifest: kakeiboManifest,
  Editor: KakeiboItemSheet,
  nav: { label: "家計簿", icon: Wallet, path: "/kakeibo", description: "支出の記録と合計" },
  actions: [{ label: "記録する", icon: Wallet, path: "/kakeibo?record=1", hint: "金額とカテゴリ" }],
  widgets: [
    {
      key: "kakeibo.record",
      label: "記録する",
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
  ],
  pages: [{ path: "/kakeibo", load: async () => ({ Component: (await import("./KakeiboPage")).KakeiboPage }) }],
};
