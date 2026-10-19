import { useEffect, useState } from "react";
import { sameDay, startOfDay } from "./dates";

const CHECK_MS = 60_000;

/**
 * 日付が変わったかを確かめ続ける。60 秒ごとと、画面に戻ったとき(visibilitychange)に確かめる。
 * 0 時ちょうどの setTimeout にしないのは、端末がスリープしている間に止まるため
 * @param onCheck 確かめる処理
 * @returns 止める関数
 */
export function watchDayChange(onCheck: () => void): () => void {
  const timer = setInterval(onCheck, CHECK_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") onCheck();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** 今日の 0 時。画面を開いたまま日付が変わったら追いかける。今日のページとカレンダーが使う */
export function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(
    () =>
      watchDayChange(() => {
        const now = startOfDay(new Date());
        setToday((t) => (sameDay(t, now) ? t : now));
      }),
    [],
  );
  return today;
}
