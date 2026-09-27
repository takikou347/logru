/**
 * 下のタブの帯の下に名前を出す回数。はじめの 3 回(アプリを開いた回数)だけ出し、4 回目から消す。
 * issue #239、kota の返し(#227)
 *
 * 数えるかどうかの計算は lib/tab-hint-count.ts(見た目を持たない、テストしやすい形)。
 * ここは localStorage の読み書きと React への配線だけを持つ。端末ごとに数える。AppShell は
 * 画面を移っても作り直さないので、1 回のアプリの起動で 1 回だけ数える。読めない環境では毎回
 * 出したままにする(困らない側に倒す)。
 */
import { useEffect, useState } from "react";
import { nextTabHintCount, shouldShowTabHint } from "@/lib/tab-hint-count";

const KEY = "logru:new-look-tab-hints-seen";

function readSeen(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? "0");
  } catch {
    return 0;
  }
}

/**
 * @param enabled 数えてよいか。新しい見た目を入れていない人では数えない(あとで入れたときに
 *   3 回分残しておく)
 */
export function useShowTabHints(enabled: boolean): boolean {
  const [show] = useState(() => {
    try {
      return shouldShowTabHint(readSeen());
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (!enabled) return;
    try {
      localStorage.setItem(KEY, String(nextTabHintCount(readSeen())));
    } catch {
      // 保存できなくても、この回は出したままにする
    }
  }, [enabled]);
  return show;
}
