import { BookOpen, Camera, Timer } from "lucide-react";
import type { ClientExtension } from "../../types.client";
import { memoriesManifest } from "../manifest";
import { MemoryItemSheet } from "./MemoryItemSheet";
import { useKomaShortcut } from "./shortcut";

/**
 * 思い出の拡張の、画面の側。docs/logru/extensions/memories/design.md
 * カレンダーでは読むだけ。消すのは思い出の画面の中で行うので、deleteItem は持たない。
 */
export const memoriesClient: ClientExtension = {
  manifest: memoriesManifest,
  Editor: MemoryItemSheet,
  nav: { label: "思い出", icon: BookOpen, path: "/memories", description: "しおり、記録、アルバム" },
  actions: [
    { label: "記録する", icon: Camera, path: "/memories?record=1", hint: "写真と一言" },
    { label: "ひとコマ", icon: Timer, path: "/memories/koma", hint: "1 時間に 1 枚" },
  ],
  useShortcut: useKomaShortcut,
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
