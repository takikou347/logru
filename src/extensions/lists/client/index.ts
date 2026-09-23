import type { ClientExtension } from "@extensions/client/types";
import { ListChecks } from "lucide-react";
import { listsManifest } from "../manifest";
import { LatestListWidget, useLatestListHint } from "./HomeWidget";
import { ListItemSheet } from "./ListItemSheet";

/**
 * 共有リストの拡張の、画面の側。docs/logru/extensions/lists/design.md
 * カレンダーの項目を押すと、リストの画面へ移るだけなので deleteItem は持たない。リストを消すのは画面の中から。0054
 */
export const listsClient: ClientExtension = {
  manifest: listsManifest,
  Editor: ListItemSheet,
  nav: { label: "リスト", icon: ListChecks, path: "/lists", description: "買い物や持ち物を共有する" },
  actions: [{ label: "リストに足す", icon: ListChecks, path: "/lists/latest", hint: "いちばん新しいリストに" }],
  useTileHint: useLatestListHint,
  widgets: [
    {
      key: "lists.latest",
      label: "リスト",
      description: "いちばん新しいリストの名前と、残りの項目の数を表示します。",
      defaultPlaced: true,
      Component: LatestListWidget,
    },
  ],
  pages: [
    { path: "/lists", load: async () => ({ Component: (await import("./ListsPage")).ListsPage }) },
    { path: "/lists/latest", load: async () => ({ Component: (await import("./ListsLatestPage")).ListsLatestPage }) },
    { path: "/lists/:id", load: async () => ({ Component: (await import("./ListDetailPage")).ListDetailPage }) },
  ],
};
