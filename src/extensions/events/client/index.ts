import type { ClientExtension } from "@extensions/client/types";
import { eventsManifest } from "../manifest";
import { deleteEvent } from "./api";
import { EventSheet } from "./EventSheet";

/** 予定の拡張の、画面の側 */
export const eventsClient: ClientExtension = {
  manifest: eventsManifest,
  Editor: EventSheet,
  deleteItem: (id, { keepalive }) => deleteEvent(id, { keepalive }),
};
