import type { GroupSummary, Me } from "@shared/api-types";
import { ArrowUp, CheckCheck, ChevronLeft, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { personOf, UserAvatarStack } from "@/components/parts/Avatars";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel } from "@/components/parts/Panel";
import { SwipeRow } from "@/components/parts/SwipeRow";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatShortDate, formatTime } from "@/lib/dates";
import { useKeyboardViewport } from "@/lib/keyboard-viewport";
import { useNewLookActive } from "@/lib/lab";
import {
  RowExpandContext,
  rowExpandState,
  useRowExpandActive,
  useRowExpandName,
  useRowExpandTransition,
} from "@/lib/row-expand";
import { useMediaQuery } from "@/lib/use-media-query";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { cn } from "@/lib/utils";
import { markJustAdded, takeJustAdded } from "@/modules/calendar/recent-items";
import type { ListItem, ListSummary } from "./api";
import {
  useAddItem,
  useDeleteItem,
  useListDetail,
  useLists,
  useListsGroups,
  useToggleItem,
  useUpdateItemText,
} from "./api";
import { EditItemSheet } from "./EditItemSheet";
import { EditListSheet } from "./EditListSheet";
import { GroupLabel, useIconOnly } from "./parts";

/**
 * 項目を足す欄。1 行打って Enter か右の「足す」を押すと足し、入力欄は空のまま次の項目を打てる。F-203
 * `autoFocus` は、いちばん新しいリストへの近道 `?add=1` から開いたときに使う。F-209
 *
 * リストはシートを使わない。新しい見た目・スマホで OS のキーボードが出ている間だけ、この欄を
 * キーボードのすぐ上に固定する(`visualViewport` に合わせる)。入れていない人・PC・キーボードが
 * 出ていない間は、これまでどおりリストの続きに流れる。0094、issue #242
 *
 * ラボの「新しい見た目」・スマホでは、押すまでは面の中の「+」の丸だけの行にする(A3 の見本)。
 * 押すと入力欄が開き、OS のキーボードが出ればそのまま上の帯に切り替わる(刷新 5 の動きは変えない)。
 * 打っている途中で空のまま欄の外を押すと、また「+」の行に戻る。issue #243
 */
function AddItemRow({ listId, autoFocus }: { listId: string; autoFocus: boolean }) {
  const addItem = useAddItem(listId);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const canSubmit = text.trim().length > 0;
  const newLook = useNewLookActive();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const keyboard = useKeyboardViewport(newLook && !desktop);
  const iconOnly = newLook && !desktop;
  const [expanded, setExpanded] = useState(!iconOnly || autoFocus);
  const [expandTick, setExpandTick] = useState(0);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // 「+」の行を押して開いたときだけ、次の描画でフォーカスする。マウントのたびには当てない
  useEffect(() => {
    if (expandTick > 0) inputRef.current?.focus();
  }, [expandTick]);

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

  if (iconOnly && !expanded) {
    return (
      <button
        type="button"
        aria-label="項目を足す"
        className="flex min-h-11 w-full items-center gap-2.5 border-t border-line text-sm text-ink-2"
        onClick={() => {
          setExpanded(true);
          setExpandTick((t) => t + 1);
        }}
      >
        <span className="grid size-[22px] place-items-center rounded-[7px] border-2 border-dashed border-ink-3 text-ink-3">
          <Plus className="size-3.5" />
        </span>
      </button>
    );
  }

  return (
    <form
      className={cn(
        "flex items-center gap-2 pt-2.5",
        keyboard.open ? "glass fixed inset-x-2 z-30 rounded-full px-3 py-2" : "border-t border-line",
      )}
      style={
        keyboard.open
          ? { bottom: keyboard.liftPx + 8, transition: "bottom var(--dur-keyboard) var(--ease-keyboard)" }
          : undefined
      }
      onSubmit={submit}
    >
      <Input
        ref={inputRef}
        value={text}
        maxLength={200}
        placeholder="項目を足す"
        aria-label="項目を足す"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (iconOnly && text.trim() === "") setExpanded(false);
        }}
      />
      <Button
        type="submit"
        variant="secondary"
        size={iconOnly ? "icon" : "default"}
        className="flex-none"
        aria-label="足す"
        disabled={!canSubmit || addItem.isPending}
      >
        {iconOnly ? <ArrowUp className="size-4" aria-hidden="true" /> : "足す"}
      </Button>
    </form>
  );
}

/**
 * 項目の行。チェックすると下へ寄り、字が薄くなる。F-204、F-205
 * 左へスワイプすると「直す」「消す」が出る。消すときは確認を出さず、5 秒だけ「元に戻す」を出す。0084、issue #12、#225
 * 足した(元に戻した)直後は膨らんで入り、消す途中は縮んで消える。動かすのは transform と opacity だけ。0044、0048、#201
 *
 * 入れていない人・PC は、文字を押すとその場で入力欄になって直せる。Enter か欄の外を押すと保存、
 * Esc か空にすると元に戻す。0084
 * ラボの「新しい見た目」・スマホでは、押した行がそのまま広がって「項目を直す」シートになる
 * (row-expand、0093)。`onEditRow` を親(ListDetailPage)から渡す。
 * チェックの押せる範囲(左)、文字を直す範囲(右)は重ならない。F-203
 */
function ItemRow({
  item,
  listId,
  onRemove,
  isLeaving,
  iconOnly,
  onEditRow,
  who,
}: {
  item: ListItem;
  listId: string;
  onRemove: (item: ListItem) => void;
  isLeaving: boolean;
  iconOnly: boolean;
  onEditRow: (item: ListItem) => void;
  /** 新しい見た目だけ、行の右に出す。足した人(未チェック)か、済みにした人と時刻。無ければ出さない。issue #243 */
  who: string | null;
}) {
  const toggleItem = useToggleItem(listId);
  const updateText = useUpdateItemText(listId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewTransitionName = useRowExpandName(item.id);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    if (iconOnly) {
      onEditRow(item);
      return;
    }
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
    <li
      className={cn("border-t border-line text-sm", entering && "item-enter")}
      data-leaving={isLeaving || undefined}
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      <SwipeRow id={item.id} onEdit={startEdit} onDelete={() => onRemove(item)}>
        <div
          className={cn(
            "grid min-h-[52px] items-center gap-1",
            iconOnly ? "grid-cols-[34px_1fr_auto]" : "grid-cols-[34px_1fr]",
          )}
        >
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
                // 新しい見た目では、右に開いた「直す」「消す」の上まで押せる範囲が伸びないよう、
                // 文字の幅だけに留める(SwipeRow の中身の幅もこれに合わせて狭まる)。issue #243
                iconOnly && "w-fit max-w-full justify-self-start",
              )}
              aria-label={`${item.text} を直す`}
              onClick={startEdit}
            >
              {item.text}
            </button>
          )}
          {iconOnly && who && <span className="truncate text-right text-xs text-ink-2">{who}</span>}
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
 * 項目の右に出す「誰が」。未チェックは足した人、チェック済みは済みにした人と時刻。
 * どちらも分からなければ何も出さない(退会した人でも personOf が「退会した人」を返す)。issue #243
 */
function whoLabel(item: ListItem, groups: GroupSummary[], me: Me): string | null {
  if (item.checked) {
    if (!item.checkedBy) return null;
    const name = personOf(item.checkedBy, groups, me).name;
    return item.checkedAt ? `${name}・${formatTime(item.checkedAt)}` : name;
  }
  return item.createdBy ? personOf(item.createdBy, groups, me).name : null;
}

/** ほかのリストの、小さな面のカード。issue #243 */
function OtherListCard({ list, me, groups }: { list: ListSummary; me: Me; groups: GroupSummary[] }) {
  const group = groups.find((g) => g.id === list.groupId);
  return (
    <Link
      to={`/lists/${list.id}`}
      className="glass flex min-w-0 flex-col gap-0.5 rounded-[20px] px-3.5 py-3 text-ink no-underline"
    >
      <GroupLabel group={group} me={me} />
      <b className="truncate text-[15px]">{list.title}</b>
      <span className="truncate text-xs text-ink-2">
        {list.itemCount === 0 ? "空" : `残り ${list.remainingCount} / ${list.itemCount}`}
        {list.date && `・${formatShortDate(list.date)}まで`}
      </span>
    </Link>
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
  const { hidden, leaving, remove } = useListItemDelete(id ?? "");
  const [editing, setEditing] = useState(false);
  const addFocused = params.get("add") === "1";
  const iconOnly = useIconOnly();
  // ほかのリストの小さな面。新しい見た目だけで読む(A3 の見本)。issue #243
  const otherListsQuery = useLists(null, iconOnly);
  // 行がそのままシートに広がる動き(共有要素)。ラボの「新しい見た目」のスマホだけで使う。0093、issue #243
  const rowExpandActive = useRowExpandActive();
  const { transitioningKey, openRow, resetRowExpand } = useRowExpandTransition(rowExpandActive);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const openItemEdit = (item: ListItem) => openRow(item.id, () => setEditingItemId(item.id));
  const closeItemEdit = () => {
    setEditingItemId(null);
    resetRowExpand();
  };
  const rowExpandValue = useMemo(
    () => rowExpandState(transitioningKey, editingItemId !== null),
    [transitioningKey, editingItemId],
  );

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
  const editingItem = items.find((i) => i.id === editingItemId) ?? null;
  const uncheckedItems = items.filter((i) => !i.checked);
  const checkedItems = items.filter((i) => i.checked);
  // 最近の出来事。済みにした人と時刻がいちばん新しい項目。A3 の見本、新しい見た目だけで使う。issue #243
  const mostRecentlyChecked = iconOnly
    ? [...checkedItems].filter((i) => i.checkedAt !== null).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0))[0]
    : undefined;
  const recentLine =
    mostRecentlyChecked?.checkedBy && mostRecentlyChecked.checkedAt
      ? `${personOf(mostRecentlyChecked.checkedBy, groups, me.data).name}が${formatTime(mostRecentlyChecked.checkedAt)}に「${mostRecentlyChecked.text}」を済みにしました`
      : null;
  const otherLists = (otherListsQuery.data ?? []).filter((l) => l.id !== list.id).slice(0, 4);

  const itemRow = (item: ListItem) => (
    <ItemRow
      key={item.id}
      item={item}
      listId={list.id}
      onRemove={remove}
      isLeaving={leaving.has(item.id)}
      iconOnly={iconOnly}
      onEditRow={openItemEdit}
      who={iconOnly ? whoLabel(item, groups, me.data) : null}
    />
  );

  return (
    <RowExpandContext.Provider value={rowExpandValue}>
      {iconOnly ? (
        <Page>
          {/* 「‹」と「…」だけの帯。共有は今ある仕組みが無いため出さない(見た目だけの載せ替えで新しい
              機能は作らない)。A3 の見本、issue #243 */}
          <header className="glass flex min-h-[58px] items-center justify-between gap-1 rounded-full py-1.5 pr-2.5 pl-1.5">
            <Button asChild variant="ghost" size="icon">
              <Link to="/lists" aria-label="戻る">
                <ChevronLeft className="size-5" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="リストを直す"
              onClick={() => setEditing(true)}
            >
              <MoreHorizontal className="size-5" />
            </Button>
          </header>
          {/* 題名は帯の下に大きく 1 回だけ。下に共有先の点・人のアイコン・最近の出来事の一行。A3 の見本 */}
          <div className="flex flex-col gap-1 px-1">
            <h1 className="truncate text-[28px] font-extrabold tracking-[-0.02em]">{list.title}</h1>
            <div className="flex min-w-0 items-center gap-2 text-xs text-ink-2">
              <GroupLabel group={group} me={me.data} />
              {group && group.members.length > 0 && (
                <UserAvatarStack userIds={group.members.map((m) => m.id)} groups={groups} me={me.data} size={20} />
              )}
              {recentLine && <span className="min-w-0 truncate">{recentLine}</span>}
            </div>
            {list.date && (
              <time className="text-xs text-ink-2">{formatShortDate(list.date)} のカレンダーに出ています</time>
            )}
          </div>
          <Panel>
            {items.length === 0 && <Empty>項目を足すと、ここに並びます。</Empty>}
            {uncheckedItems.length > 0 && <ul>{uncheckedItems.map(itemRow)}</ul>}
            <AddItemRow listId={list.id} autoFocus={addFocused} />
            {checkedItems.length > 0 && (
              <>
                <div className="flex items-center gap-1 border-t border-line pt-2.5 text-xs font-medium text-ink-2">
                  <CheckCheck className="size-3.5" aria-hidden="true" />
                  {checkedItems.length}
                </div>
                <ul>{checkedItems.map(itemRow)}</ul>
              </>
            )}
          </Panel>
          {otherLists.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-sm font-bold">ほかのリスト</h2>
              <div className="grid grid-cols-2 gap-2">
                {otherLists.map((l) => (
                  <OtherListCard key={l.id} list={l} me={me.data} groups={groups} />
                ))}
              </div>
            </div>
          )}
        </Page>
      ) : (
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
            {items.length === 0 ? <Empty>項目を足すと、ここに並びます。</Empty> : <ul>{items.map(itemRow)}</ul>}
            <AddItemRow listId={list.id} autoFocus={addFocused} />
          </Panel>
        </Page>
      )}
      {editing && <EditListSheet list={list} onClose={() => setEditing(false)} />}
      {editingItem && <EditItemSheet listId={list.id} item={editingItem} onClose={closeItemEdit} onDelete={remove} />}
    </RowExpandContext.Provider>
  );
}
