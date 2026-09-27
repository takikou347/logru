import type { ClientExtension } from "@extensions/client/types";
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
};
