/**
 * カレンダーの土台のウィジェット(カレンダー本体、選んだ日の予定、このあと)だけが使う、共有の状態。0029
 *
 * この 3 つは、カレンダーが土台であるために特別扱いする。ほかの拡張のウィジェットは、
 * ここを読まず、自分の hook で自分のデータを読む。ホームはこの中身を知らない。
 */
import { createContext, type ReactNode, useContext } from "react";
import type { ViewItem } from "../calendar/model";

export type CalendarView = "month" | "week" | "day";

/**
 * 月を送る操作の見た目。日めくりの 3D で動かすのは月の表(MonthFlipDeck)だけなので、
 * ここに要る値をまとめて渡す。#99
 */
export type MonthNav = {
  /** いま絞っているグループ。隣の月の項目を仕立てるのに使う */
  groupFilter: string | null;
  hiddenIds: Set<string>;
  /** 消す操作の 5 秒の間、画面から隠している項目。itemKey の形 */
  deletedKeys: Set<string>;
  /** PC の矢印ボタンとキーで月を送ったときの合図。id が変わるたびに 1 回だけめくる */
  flipRequest: { dir: 1 | -1; id: number } | null;
  /** めくり終えたとき(またはめくらずに切り替えるとき)に呼ぶ。実際に選ぶ日を進める */
  onChangeMonth: (dir: 1 | -1) => void;
  /** 端末が動きを減らす設定にしているか。スワイプの追従とめくりを止め、切り替えるだけにする */
  reducedMotion: boolean;
};

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
  monthNav: MonthNav;
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
