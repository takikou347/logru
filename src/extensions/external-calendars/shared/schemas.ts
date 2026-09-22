import { GROUP_COLOR_KEYS } from "@shared/colors";
import { z } from "zod";

/** 外部のカレンダーを登録するときの入力 */
export const externalCalendarInput = z.object({
  name: z.string().trim().min(1, "名前を入れてください。").max(40, "名前は 40 文字までです。"),
  color: z.enum(GROUP_COLOR_KEYS, { message: "色を選んでください。" }),
  url: z.string().trim().min(1, "URL を入れてください。").max(2000, "URL が長すぎます。"),
});

export type ExternalCalendarInput = z.infer<typeof externalCalendarInput>;

/** `GET /api/external-calendars` の 1 件。URL そのものは返さず、ホストだけを返す */
export type ExternalCalendarSummary = {
  id: string;
  name: string;
  color: string;
  /** URL のホスト。例は calendar.google.com */
  host: string;
  /** 最後に読めた時刻。ミリ秒の UTC。まだ 1 度も読めていなければ null */
  lastSyncedAt: number | null;
  /** 最後に読んだときの失敗。読めていれば null */
  lastError: string | null;
};
