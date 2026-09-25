import { Pencil, Trash2 } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatShortDate } from "@/lib/dates";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { cn } from "@/lib/utils";
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
    await addItem.mutateAsync(value);
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
 * 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。issue #12
 *
 * 文字を押すと、その場で入力欄になって直せる。Enter か欄の外を押すと保存、Esc か空にすると元に戻す。
 * チェックの押せる範囲(左)、文字を直す範囲(中)、消す範囲(右)は重ならない。F-203
 */
function ItemRow({ item, listId, onRemove }: { item: ListItem; listId: string; onRemove: (item: ListItem) => void }) {
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

  return (
    <li className="grid min-h-[52px] grid-cols-[34px_1fr_auto] items-center gap-1 border-t border-line text-sm">
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
      <button
        type="button"
        className="grid size-9 place-items-center text-ink-3"
        aria-label={`${item.text} を消す`}
        onClick={() => onRemove(item)}
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
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
  const deleteItem = useDeleteItem(id ?? "");
  const { pending, remove } = useUndoableDelete("項目を消しました");
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
  const items = [...list.items].filter((i) => !pending.has(i.id)).sort((a, b) => Number(a.checked) - Number(b.checked));
  const removeItem = (item: ListItem) =>
    remove(item.id, ({ keepalive }) => deleteItem.mutateAsync({ id: item.id, keepalive }));
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
                <ItemRow key={item.id} item={item} listId={list.id} onRemove={removeItem} />
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
