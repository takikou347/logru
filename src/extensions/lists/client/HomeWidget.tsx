import { ListChecks } from "lucide-react";
import { HomeWidgetCard } from "@/components/parts/HomeWidgetCard";
import { useLists } from "./api";

/** 機能のタイルに出す短い字。いちばん新しいリストの残りの数。使っていないときは読み込まない。0058 */
export function useLatestListHint(enabled: boolean): string | null {
  const lists = useLists(null, enabled);
  const latest = (lists.data ?? [])[0];
  return enabled && latest ? `残り ${latest.remainingCount}` : null;
}

/**
 * 「リストに足す」。押すといちばん新しいリストの画面が、入力欄にカーソルが入った状態で開く。F-209
 * 前は機能のシートの `actions` にあった近道。ホームのウィジェットへ移した。既定では並べない。
 */
export function AddToListWidget() {
  return (
    <HomeWidgetCard
      to="/lists/latest"
      testId="widget-lists-add"
      icon={ListChecks}
      label="リストに足す"
      hint="いちばん新しいリストに"
    />
  );
}

/**
 * 「リスト」。いちばん新しいリストの名前と、残りの項目の数を出す。押すとそのリストへ移る。F-209
 * リストが無ければ、作るよう促し、押すと一覧へ移る。
 */
export function LatestListWidget() {
  const lists = useLists(null);
  const latest = (lists.data ?? [])[0];
  const hint = !lists.data ? "…" : latest ? `残り ${latest.remainingCount}` : "作ってみましょう";
  return (
    <HomeWidgetCard
      to={latest ? `/lists/${latest.id}` : "/lists"}
      testId="widget-lists-latest"
      icon={ListChecks}
      label={latest ? latest.title : "リスト"}
      hint={hint}
    />
  );
}
