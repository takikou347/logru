import type { ClientExtension } from "@extensions/client/types";
import { BookOpen, Camera, Timer } from "lucide-react";
import { memoriesManifest } from "../manifest";
import { describeMemoriesNotification } from "../shared/notifications";
import { KomaHomeWidget, RecordHomeWidget } from "./HomeWidget";
import { MemoryItemSheet } from "./MemoryItemSheet";
import { MemoryLinkField } from "./MemoryLinkField";
import { useKomaShortcut } from "./shortcut";

/**
 * 思い出の拡張の、画面の側。docs/logru/extensions/memories/design.md
 * カレンダーでは読むだけ。消すのは思い出の画面の中で行うので、deleteItem は持たない。
 */
export const memoriesClient: ClientExtension = {
  manifest: memoriesManifest,
  Editor: MemoryItemSheet,
  nav: { label: "思い出", icon: BookOpen, path: "/memories", description: "しおり、記録、アルバム" },
  // 機能のシートには出さない。actions は「機能を足す」直後の案内だけに使う。どちらもホームのウィジェットにある。0019
  actions: [
    { label: "写真を記録する", icon: Camera, path: "/memories?record=1", hint: "写真と一言" },
    { label: "ひとコマ", icon: Timer, path: "/memories/koma", hint: "1 時間に 1 枚" },
  ],
  useShortcut: useKomaShortcut,
  notifies: "ひとコマの時間",
  describeNotification: describeMemoriesNotification,
  itemAddons: [{ extension: "events", Component: MemoryLinkField }],
  // 前の「思い出の近道」(memories.shortcut)は、この 2 つに置き換えた。移行の 0013 が並びを書き換える。0037
  widgets: [
    {
      key: "memories.koma",
      label: "ひとコマ",
      description: "ひとコマの画面を開きます。1 時間に 1 枚、いまの写真を残せます。",
      defaultPlaced: true,
      Component: KomaHomeWidget,
    },
    {
      key: "memories.record",
      label: "写真を記録する",
      description: "記録のシートを開きます。写真と一言を残せます。",
      defaultPlaced: true,
      Component: RecordHomeWidget,
    },
  ],
  pages: [
    { path: "/memories", load: async () => ({ Component: (await import("./MemoriesPage")).MemoriesPage }) },
    { path: "/memories/on/:date", load: async () => ({ Component: (await import("./OnDayPage")).OnDayPage }) },
    { path: "/memories/koma", load: async () => ({ Component: (await import("./KomaDaysPage")).KomaDaysPage }) },
    { path: "/memories/koma/now", load: async () => ({ Component: (await import("./KomaNowPage")).KomaNowPage }) },
    { path: "/memories/:id", load: async () => ({ Component: (await import("./MemoryShell")).MemoryRedirect }) },
    { path: "/memories/:id/shiori", load: async () => ({ Component: (await import("./ShioriPage")).ShioriPage }) },
    { path: "/memories/:id/days/:n", load: async () => ({ Component: (await import("./DayPage")).DayPage }) },
    { path: "/memories/:id/album", load: async () => ({ Component: (await import("./AlbumPage")).AlbumPage }) },
  ],
};
