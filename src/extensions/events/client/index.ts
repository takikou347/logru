import { api } from "@/lib/api";
import type { ClientExtension } from "../../types.client";
import { eventsManifest } from "../manifest";
import { EventSheet } from "./EventSheet";

/** 予定の拡張の、画面の側 */
export const eventsClient: ClientExtension = {
  manifest: eventsManifest,
  Editor: EventSheet,
  deleteItem: (id, { keepalive }) => api(`/events/${id}`, { method: "DELETE", keepalive }),
};
