/**
 * 今日のページの、共有リストの節の中身。0092、issue #240
 *
 * 共有リストは日付を持たないことが多く、その日の項目(dayItems)はほとんど空になる。日に依らず、
 * いちばん新しいリストの名前と残りの件数を出す(ホームのウィジェット LatestListWidget と同じデータ)。
 * どの日を見ていても同じ中身になる。
 */
import { ChevronRight, ListChecks } from "lucide-react";
import { Link } from "react-router";
import { useLists } from "./api";

export function ListsTodaySection() {
  const lists = useLists(null);
  const latest = (lists.data ?? [])[0];
  const hint = !lists.data ? "…" : latest ? `残り ${latest.remainingCount}` : "作ってみましょう";
  return (
    <Link
      to={latest ? `/lists/${latest.id}` : "/lists"}
      data-testid="today-section-lists-latest"
      className="flex min-h-11 items-center gap-2 rounded-(--r-field) px-1 py-1 text-ink no-underline"
    >
      <ListChecks className="size-4 flex-none text-ink-2" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{latest ? latest.title : "リスト"}</span>
      <span className="flex-none text-xs text-ink-2">{hint}</span>
      <ChevronRight className="size-4 flex-none text-ink-2" aria-hidden="true" />
    </Link>
  );
}
