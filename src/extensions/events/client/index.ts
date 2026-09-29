import type { ClientExtension } from "@extensions/client/types";
import { CalendarPlus } from "lucide-react";
import { eventsManifest } from "../manifest";
import { describeEventNotification } from "../shared/notifications";
import { deleteEvent, loadEvent } from "./api";
import { EventSheet } from "./EventSheet";
import { useAnniversaryShortcut } from "./shortcut";

/** 予定の拡張の、画面の側 */
export const eventsClient: ClientExtension = {
  manifest: eventsManifest,
  Editor: EventSheet,
  deleteItem: (id, opts) => deleteEvent(id, opts),
  describeNotification: describeEventNotification,
  loadItem: loadEvent,
  useShortcut: useAnniversaryShortcut,
  // 今日に新しい予定のシートが開いた状態で始まる。ホーム画面のアイコンの近道(shortcuts)と同じ道順。
  // 下のタブの帯の「+」の放射にも出す。0091、issue #239
  actions: [{ label: "予定を足す", icon: CalendarPlus, path: "/?new=1" }],
};
