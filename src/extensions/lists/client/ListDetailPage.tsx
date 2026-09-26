import { Pencil } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel } from "@/components/parts/Panel";
import { SwipeRow } from "@/components/parts/SwipeRow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatShortDate } from "@/lib/dates";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { cn } from "@/lib/utils";
import { markJustAdded, takeJustAdded } from "@/modules/calendar/recent-items";
import type { ListItem } from "./api";
import { useAddItem, useDeleteItem, useListDetail, useListsGroups, useToggleItem, useUpdateItemText } from "./api";
import { EditListSheet } from "./EditListSheet";
import { GroupLabel } from "./parts";

/**
 * 項目を足す欄。1 行打って Enter か右の「足す」を押すと足し、入力欄は空のまま次の項目を打てる。F-203
 * `autoFocus` は、いちばん新しいリストへの近道 `?add=1` から開いたときに使う。F-209
 */
function AddItemRow({ listId, autoFocus }: { listId: string; autoFocus: boolean }) {
  const addItem = useAddItem(listId);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = text.trim().length > 0;

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    const created = await addItem.mutateAsync(value);
    // 足した項目が、一覧に出たときに膨らんで入る動きを付ける。0044、0048、#201
    markJustAdded(created.id);
    // 送った後も入力欄からフォーカスを外さず、続けて次の項目を打てるようにする。F-203
    inputRef.current?.focus();
  }

  return (
    <form className="flex items-center gap-2 border-t border-line pt-2.5" onSubmit={submit}>
      <Input
        ref={inputRef}
        value={text}
        maxLength={200}
        placeholder="項目を足す"
        aria-label="項目を足す"
        onChange={(e) => setText(e.target.value)}
      />
      <Button type="submit" variant="secondary" className="flex-none" disabled={!canSubmit || addItem.isPending}>
        足す
      </Button>
    </form>
  );
}

/**
 * 項目の行。チェックすると下へ寄り、字が薄くなる。F-204、F-205
 * 左へスワイプすると「直す」「消す」が出る。消すときは確認を出さず、5 秒だけ「元に戻す」を出す。0084、issue #12、#225
 * 足した(元に戻した)直後は膨らんで入り、消す途中は縮んで消える。動かすのは transform と opacity だけ。0044、0048、#201
 *
 * 文字を押すと、その場で入力欄になって直せる。Enter か欄の外を押すと保存、Esc か空にすると元に戻す。0084
 * チェックの押せる範囲(左)、文字を直す範囲(右)は重ならない。F-203
 */
function ItemRow({
  item,
  listId,
  onRemove,
  isLeaving,
}: {
  item: ListItem;
  listId: string;
  onRemove: (item: ListItem) => void;
  isLeaving: boolean;
}) {
  const toggleItem = useToggleItem(listId);
  const updateText = useUpdateItemText(listId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setText(item.text);
    setEditing(true);
  }

  async function commit() {
    const value = text.trim();
    setEditing(false);
    if (!value || value === item.text) return;
    try {
      await updateText.mutateAsync({ id: item.id, text: value });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setText(item.text);
      setEditing(false);
    }
  }

  // 描いた瞬間に 1 度だけ読む。足した直後の再描画と、読み直しの描き直しを見分けるため
  const [entering] = useState(() => takeJustAdded(item.id));
  return (
    <li className={cn("border-t border-line text-sm", entering && "item-enter")} data-leaving={isLeaving || undefined}>
      <SwipeRow id={item.id} onEdit={startEdit} onDelete={() => onRemove(item)}>
        <div className="grid min-h-[52px] grid-cols-[34px_1fr] items-center gap-1">
          <Checkbox
            checked={item.checked}
            aria-label={`${item.text} をチェックする`}
            onCheckedChange={(v) => toggleItem.mutate({ id: item.id, checked: v === true })}
            className="size-[22px] rounded-[7px]"
          />
          {editing ? (
            <Input
              ref={inputRef}
              value={text}
              maxLength={200}
              aria-label={`${item.text} を直す`}
              className="h-9 px-2 py-1 text-sm"
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={onKeyDown}
            />
          ) : (
            <button
              type="button"
              className={cn(
                "truncate rounded-(--r-field) py-1 text-left font-medium",
                item.checked && "text-ink-2 line-through",
              )}
              aria-label={`${item.text} を直す`}
              onClick={startEdit}
            >
              {item.text}
            </button>
          )}
        </div>
      </SwipeRow>
    </li>
  );
}

/** 縮んで消える動きの長さ。globals.css の [data-leaving] と同じ --dur-base(220ms)。0044、0048、#201 */
const EXIT_MS = 220;

function without(s: Set<string>, key: string): Set<string> {
  if (!s.has(key)) return s;
  const next = new Set(s);
  next.delete(key);
  return next;
}

function withKey(s: Set<string>, key: string): Set<string> {
  if (s.has(key)) return s;
  const next = new Set(s);
  next.add(key);
  return next;
}

/**
 * 項目を消す。5 秒の「元に戻す」そのものは lib/use-undoable-delete が持つ。ここで足すのは、消した瞬間に
 * 縮んで消える動き(leaving)と、動きが終わってから一覧から外す(hidden)の 2 段階。
 * modules/calendar/CalendarPage.tsx の useCalendarDelete と同じ仕組み。0044、0048、#201
 *
 * @returns hidden は一覧から外す項目の id。leaving は縮んで消える動きの途中の項目の id。remove は消す関数
 */
function useListItemDelete(listId: string) {
  const deleteItem = useDeleteItem(listId);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const exitTimers = useRef(new Map<string, number>());

  const clearExit = useCallback((key: string) => {
    const t = exitTimers.current.get(key);
    if (t != null) {
      window.clearTimeout(t);
      exitTimers.current.delete(key);
    }
  }, []);

  const onRestore = useCallback(
    (key: string) => {
      clearExit(key);
      markJustAdded(key);
      setLeaving((s) => without(s, key));
      setHidden((s) => without(s, key));
    },
    [clearExit],
  );

  // 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。issue #12
  const { remove: removePending } = useUndoableDelete("項目を消しました", onRestore);

  const remove = useCallback(
    (item: ListItem) => {
      const key = item.id;
      setLeaving((s) => withKey(s, key));
      exitTimers.current.set(
        key,
        window.setTimeout(() => {
          exitTimers.current.delete(key);
          setHidden((s) => withKey(s, key));
        }, EXIT_MS),
      );
      removePending(key, async ({ keepalive }) => {
        try {
          await deleteItem.mutateAsync({ id: item.id, keepalive });
        } finally {
          if (!keepalive) {
            setHidden((s) => without(s, key));
            setLeaving((s) => without(s, key));
          }
        }
      });
    },
    [removePending, deleteItem],
  );

  return { hidden, leaving, remove };
}

/**
 * リストの詳細。F-203〜F-208
 * 項目を足す、チェックする、消す。名前と日付は「直す」から変えられる。
 * 開いている間は 5 秒おきと、フォーカスに戻ったときに読み直し、ほかの人の変更にすぐ気付ける。F-207
 */
export function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const { groups } = useListsGroups();
  const detail = useListDetail(id ?? null);
  const { hidden, leaving, remove } = useListItemDelete(id ?? "");
  const [editing, setEditing] = useState(false);
  const addFocused = params.get("add") === "1";

  // biome-ignore lint/correctness/useExhaustiveDependencies: 開いた直後の 1 度だけ、クエリを消したい
  useEffect(() => {
    if (addFocused) setParams((p) => (p.delete("add"), p), { replace: true });
  }, []);
  // リストごとの色は付けていない画面。0071
  useAppFrame({ poolColors: [] });

  if (!id) return null;
  if (detail.isPending || !me.data) return <Loading />;
  if (detail.error || !detail.data) {
    return (
      <Page>
        <PageBar title="リスト" back="/lists" />
        <LoadFailure what="リスト" error={detail.error} onRetry={() => void detail.refetch()} />
      </Page>
    );
  }

  const list = detail.data;
  const items = [...list.items].filter((i) => !hidden.has(i.id)).sort((a, b) => Number(a.checked) - Number(b.checked));
  const group = groups.find((g) => g.id === list.groupId);

  return (
    <>
      <Page>
        <PageBar title={list.title} back="/lists" />
        <Panel>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate text-[17px]">{list.title}</b>
              <span className="flex items-center gap-2">
                <GroupLabel group={group} me={me.data} />
                {list.date && (
                  <time className="text-xs text-ink-2">{formatShortDate(list.date)} のカレンダーに出ています</time>
                )}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="リストを直す"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
          </div>
          {items.length === 0 ? (
            <Empty>項目を足すと、ここに並びます。</Empty>
          ) : (
            <ul>
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  listId={list.id}
                  onRemove={remove}
                  isLeaving={leaving.has(item.id)}
                />
              ))}
            </ul>
          )}
          <AddItemRow listId={list.id} autoFocus={addFocused} />
        </Panel>
      </Page>
      {editing && <EditListSheet list={list} onClose={() => setEditing(false)} />}
    </>
  );
}
