/**
 * 上の帯に置く、探す入口。押すとダイアログで開き、題名と場所を探す。PC は `/` のキーでも開く。F-38、0046
 *
 * 押した結果はカレンダーの項目の形のまま渡し、開き方は呼び出し側(CalendarPage)に任せる。
 * 探す中身は拡張が決める。カレンダーは拡張の中身を知らない。
 */
import type { CalendarItem, GroupSummary, Me } from "@shared/api-types";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/parts/EmptyState";
import { Dot } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSearch } from "@/modules/search/api";
import { kindIconOf } from "../kind-icon";
import { decorate, KIND_LABEL, kindOf, type ViewItem } from "../model";

/** 探す文字を止めてから API を呼ぶまでの間。連打のたびに探させない */
const DEBOUNCE_MS = 300;

/** `2026年9月23日` の形。年をまたいだ結果も見分けられるよう、月日だけの表記にしない */
function formatResultDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function ResultRow({ item, onOpen }: { item: ViewItem; onOpen: (item: ViewItem) => void }) {
  const kind = kindOf(item);
  const Icon = kind !== "event" ? kindIconOf(item) : null;
  return (
    <li className="border-line not-first:border-t">
      <button
        type="button"
        className="flex min-h-14 w-full flex-col justify-center gap-0.5 rounded-[14px] px-2 py-2 text-left"
        onClick={() => onOpen(item)}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Dot color={item.color} />
          {Icon && <Icon className="size-3.5 flex-none text-ink-2" aria-hidden="true" />}
          {kind !== "event" && <span className="sr-only">{KIND_LABEL[kind]}、</span>}
          <span className="truncate">{item.title}</span>
        </span>
        <span className="truncate text-xs text-ink-2">
          {formatResultDate(item.startsAt)}
          {item.place && ` ・ ${item.place}`}
          {" ・ "}
          {item.groupName}
        </span>
      </button>
    </li>
  );
}

function SearchDialog({
  groups,
  me,
  onClose,
  onOpen,
}: {
  groups: GroupSummary[];
  me: Me;
  onClose: () => void;
  onOpen: (item: CalendarItem) => void;
}) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const query = debounced.trim();
  const results = useSearch(debounced);
  // 新しい日付の順。API も同じ順で返すが、届く前の入れ替わりに備えて画面側でもそろえる
  const items = decorate(results.data ?? [], groups, me).sort((a, b) => b.startsAt - a.startsAt);

  return (
    <ResponsiveSheet title="探す" onClose={onClose}>
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="題名、場所で探す"
        aria-label="探す"
      />
      {query.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">題名や場所を入れて探します。</p>
      ) : results.isLoading ? (
        <p className="py-6 text-center text-sm text-ink-2">探しています…</p>
      ) : items.length === 0 ? (
        <EmptyState
          pose="search"
          bordered={false}
          action={{
            label: "文字を消す",
            onClick: () => {
              setText("");
              inputRef.current?.focus();
            },
          }}
        >
          見つかりませんでした。
        </EmptyState>
      ) : (
        <ul className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => (
            <ResultRow
              key={`${item.extension}:${item.id}`}
              item={item}
              onOpen={(i) => {
                onClose();
                onOpen(i);
              }}
            />
          ))}
        </ul>
      )}
    </ResponsiveSheet>
  );
}

/**
 * 探すボタン。押す、あるいは PC で `/` を押すとダイアログを開く。
 * 別の入力欄に文字を打っている間は `/` を奪わない。
 */
export function SearchButton({
  groups,
  me,
  onOpen,
}: {
  groups: GroupSummary[];
  me: Me;
  onOpen: (item: CalendarItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    if (!desktop) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [desktop]);

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="探す" onClick={() => setOpen(true)}>
        <Search className="size-5" />
      </Button>
      {open && <SearchDialog groups={groups} me={me} onClose={() => setOpen(false)} onOpen={onOpen} />}
    </>
  );
}
