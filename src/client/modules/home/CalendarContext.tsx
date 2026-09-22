/**
 * カレンダーの土台のウィジェット(カレンダー本体、選んだ日の予定、このあと)だけが使う、共有の状態。0028
 *
 * この 3 つは、カレンダーが土台であるために特別扱いする。ほかの拡張のウィジェットは、
 * ここを読まず、自分の hook で自分のデータを読む。ホームはこの中身を知らない。
 */
import { createContext, type ReactNode, useContext } from "react";
import type { ViewItem } from "../calendar/model";

export type CalendarView = "month" | "week" | "day";

export type CalendarHomeValue = {
  view: CalendarView;
  today: Date;
  selected: Date;
  days: Date[];
  items: ViewItem[];
  upcoming: ViewItem[];
  open: (item: ViewItem) => void;
  /** 月の表で日付を押したとき。その日を選び、新しく作るシートを開く */
  onPressDay: (day: Date) => void;
  /** 週の一覧で日を選んだとき。日の表示に切り替える */
  onSelectWeekDay: (day: Date) => void;
};

const CalendarHomeContext = createContext<CalendarHomeValue | null>(null);

export function CalendarHomeProvider({ value, children }: { value: CalendarHomeValue; children: ReactNode }) {
  return <CalendarHomeContext.Provider value={value}>{children}</CalendarHomeContext.Provider>;
}

/** カレンダーの土台のウィジェットの中でだけ呼べる */
export function useCalendarHome(): CalendarHomeValue {
  const ctx = useContext(CalendarHomeContext);
  if (!ctx) throw new Error("useCalendarHome はホームの土台のウィジェットの中でだけ呼べます。");
  return ctx;
}
