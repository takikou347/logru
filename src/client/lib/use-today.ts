import { useSyncExternalStore } from "react";
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

let current = startOfDay(new Date());
const listeners = new Set<() => void>();
let stopWatching: (() => void) | null = null;

function refresh(): boolean {
  const now = startOfDay(new Date());
  if (sameDay(current, now)) return false;
  current = now;
  return true;
}

/** 日付を確かめ、変わっていれば購読している全員に知らせる */
function checkToday() {
  if (refresh()) for (const l of [...listeners]) l();
}

/** 今日の 0 時を見張る購読。見張りは画面全体で 1 本だけで、最初の購読で始まり、最後の購読で止まる */
export function subscribeToday(listener: () => void): () => void {
  if (listeners.size === 0) refresh();
  listeners.add(listener);
  if (listeners.size === 1) {
    stopWatching = watchDayChange(checkToday);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}

/** 今の今日の 0 時。誰も見張っていない間に日が変わっていても、読むときに追いつく */
export function getToday(): Date {
  if (listeners.size === 0) refresh();
  return current;
}

/** 今日の 0 時。画面を開いたまま日付が変わったら追いかける。今日のページとカレンダーと予定の近道が使う。#305 */
export function useToday(): Date {
  return useSyncExternalStore(subscribeToday, getToday);
}
