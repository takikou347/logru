import type { GroupSummary, Me } from "@shared/api-types";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { UserAvatar } from "@/components/parts/Avatars";
import { Chip } from "@/components/parts/Chip";
import { Empty, Panel } from "@/components/parts/Panel";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatShortDate, formatSpan } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/modules/calendar/api";
import { dayKeyIn, memoryDays } from "../shared/days";
import { memoryOfEvent } from "../shared/links";
import type { ItemKind, MemoryDetail, MemoryItem } from "../shared/types";
import { useItemMutations, useMemoryList } from "./api";
import { MemoryShell, type ShellProps } from "./MemoryShell";
import { formatClock } from "./parts";

const KINDS = [
  { value: "wish", label: "やりたいこと" },
  { value: "todo", label: "やること" },
  { value: "packing", label: "持ち物" },
] as const;

/** しおりの画面。やりたいこと、やること、持ち物。F-103〜F-106 */
export function ShioriPage() {
  return <MemoryShell face="shiori">{(p) => <Shiori {...p} />}</MemoryShell>;
}

function Shiori({ detail, me, group }: ShellProps) {
  const [kind, setKind] = useState<ItemKind>("wish");
  const { memory, items } = detail;
  const now = Date.now();
  const left = Math.max(
    0,
    Math.round(
      (Date.parse(dayKeyIn(memory.startsAt, memory.timeZone)) - Date.parse(dayKeyIn(now, memory.timeZone))) /
        86_400_000,
    ),
  );
  const todoLeft = items.filter((i) => i.kind === "todo" && !i.doneAt).length;
  const count = (k: ItemKind) => items.filter((i) => i.kind === k).length;

  return (
    <>
      <section
        className="glass relative grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-2 rounded-panel px-5 pt-5 pb-4"
        aria-label="期間"
      >
        <span
          aria-hidden="true"
          className="absolute -top-px left-6 h-[30px] w-[18px] bg-primary [clip-path:polygon(0_0,100%_0,100%_100%,50%_76%,0_100%)]"
        />
        <p className="col-span-2 pt-6 text-[32px] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap">
          {formatSpan(memory.startsAt, memory.endsAt, memory.timeZone)}
        </p>
        <p className="flex items-center gap-2 text-xs text-ink-2">
          <span className="flex">
            {(group?.members ?? []).slice(0, 4).map((m, i) => (
              <UserAvatar
                key={m.id}
                userId={m.id}
                groups={group ? [group] : []}
                me={me}
                className={cn(i > 0 && "-ml-2")}
              />
            ))}
          </span>
          {todoLeft > 0 ? <b className="font-bold text-sun">やること 残り {todoLeft}</b> : "やることはすべて完了"}
        </p>
        {now < memory.startsAt ? (
          <p className="text-right leading-none">
            <span className="mb-1 block text-[11px] text-ink-2">出発まで</span>
            <span className="text-[44px] font-extrabold tracking-[-0.04em]">{left}</span>
            <span className="ml-0.5 text-xs font-bold">日</span>
          </p>
        ) : (
          <p className="text-right text-sm font-bold">{now < memory.endsAt ? "期間中" : "終了"}</p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="しおりの中身">
        {KINDS.map((k) => (
          <Chip
            key={k.value}
            role="tab"
            aria-selected={kind === k.value}
            aria-pressed={kind === k.value}
            className="justify-center px-2"
            onClick={() => setKind(k.value)}
          >
            {k.label} <span className="font-bold">{count(k.value)}</span>
          </Chip>
        ))}
      </div>

      {kind === "wish" && <Wishes detail={detail} group={group} me={me} />}
      {kind === "todo" && <Todos detail={detail} group={group} me={me} />}
      {kind === "packing" && <Packing detail={detail} group={group} me={me} />}
    </>
  );
}

type ListProps = { detail: MemoryDetail; group: GroupSummary | undefined; me: Me };

/** やりたいこと。「通して」と日ごと。日ごとには、そのグループのその日の予定も並べる。F-103、F-106 */
function Wishes({ detail, group, me }: ListProps) {
  const { memory, items } = detail;
  const days = memoryDays(memory);
  // この思い出に入る予定だけを並べる。外した予定と、先に始まる思い出に入った予定は出さない。0020
  const groupList = useMemoryList(memory.groupId);
  const groupMemories = groupList.data?.memories.filter((m) => m.groupId === memory.groupId) ?? [memory];
  const calendar = useCalendar(memory.startsAt, memory.endsAt);
  const events = (calendar.data ?? []).filter(
    (e) => e.extension === "events" && memoryOfEvent(e, groupMemories)?.id === memory.id,
  );
  const wishes = items.filter((i) => i.kind === "wish");
  const loose = wishes.filter((w) => w.dayIndex === null || w.dayIndex >= days.length);
  return (
    <>
      <Panel aria-label="いつでも">
        <h2 className="flex items-baseline gap-2 text-sm font-bold">
          いつでも<span className="ml-auto text-[11px] font-medium text-ink-2">日を決めずにやりたいこと</span>
        </h2>
        <ItemRows items={loose} detail={detail} group={group} me={me} />
        <AddRow detail={detail} kind="wish" dayIndex={null} placeholder="やりたいことを追加" />
      </Panel>
      {days.map((day, i) => {
        const dayEvents = events.filter((e) => dayKeyIn(e.startsAt, memory.timeZone) === day);
        const dayWishes = wishes.filter((w) => w.dayIndex === i);
        return (
          <Panel key={day} aria-label={`${day} のしおり`}>
            <h2 className="flex items-baseline gap-2 text-sm font-bold">
              <span className="text-xl font-extrabold tracking-[-0.02em]">{formatShortDate(day)}</span>
              <span className="ml-auto text-[11px] font-medium text-ink-2">予定 {dayEvents.length} 件</span>
            </h2>
            <ul>
              {dayEvents.map((e) => (
                <li
                  key={e.id}
                  className="grid min-h-11 grid-cols-[46px_1fr] items-center border-t border-line text-sm text-ink-2"
                >
                  <time>{e.allDay ? "終日" : formatClock(e.startsAt, memory.timeZone)}</time>
                  <span
                    className="flex items-center gap-2 before:h-[18px] before:w-[3px] before:rounded-sm before:bg-(--c) before:content-['']"
                    style={{ ["--c" as string]: `var(--${group?.color ?? "nezumi"})` }}
                  >
                    {e.title}
                  </span>
                </li>
              ))}
            </ul>
            <ItemRows items={dayWishes} detail={detail} group={group} me={me} />
            <AddRow detail={detail} kind="wish" dayIndex={i} placeholder="この日にやりたいことを追加" />
          </Panel>
        );
      })}
    </>
  );
}

/** やること。済んでいないものを上に、期限を過ぎたら朱。F-104 */
function Todos({ detail, group, me }: ListProps) {
  const todos = detail.items.filter((i) => i.kind === "todo");
  const sorted = [...todos].sort(
    (a, b) => Number(Boolean(a.doneAt)) - Number(Boolean(b.doneAt)) || (a.dueOn ?? "9").localeCompare(b.dueOn ?? "9"),
  );
  return (
    <Panel aria-label="やること">
      <h2 className="flex items-baseline text-sm font-bold">
        やること<span className="ml-auto text-[11px] font-medium text-ink-2">出発までに</span>
      </h2>
      {sorted.length === 0 && <Empty>予約や下調べなど、出発までにやることを追加できます。</Empty>}
      <ItemRows items={sorted} detail={detail} group={group} me={me} />
      <AddRow detail={detail} kind="todo" placeholder="やることを追加" group={group} withDue />
    </Panel>
  );
}

/** 持ち物。誰が持つか。前の思い出の持ち物を写せる。F-105 */
function Packing({ detail, group, me }: ListProps) {
  const packing = detail.items.filter((i) => i.kind === "packing");
  const list = useMemoryList(detail.memory.groupId);
  const others = (list.data?.memories ?? []).filter((m) => m.id !== detail.memory.id);
  const { copy } = useItemMutations(detail.memory.id);
  return (
    <Panel aria-label="持ち物">
      <h2 className="flex items-baseline text-sm font-bold">持ち物</h2>
      {packing.length === 0 && <Empty>持ち物を追加すると、誰が持っていくかを決められます。</Empty>}
      <ItemRows items={packing} detail={detail} group={group} me={me} />
      <AddRow detail={detail} kind="packing" placeholder="持ち物を追加" group={group} />
      {others.length > 0 && (
        <label className="flex min-h-11 items-center justify-between gap-3 border-t border-line pt-2 text-sm">
          ほかの思い出からコピー
          <select
            className="min-h-10 max-w-[55%] rounded-xl border border-line bg-field px-2 text-sm"
            value=""
            onChange={(e) => e.target.value && copy.mutate(e.target.value)}
          >
            <option value="">選択</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </Panel>
  );
}

/** 担当の名前。空なら「みんな」 */
function assigneeName(item: MemoryItem, group: GroupSummary | undefined): string | null {
  if (item.kind === "wish") return null;
  if (!item.assigneeId) return "みんな";
  return group?.members.find((m) => m.id === item.assigneeId)?.name ?? "みんな";
}

/** しおりの行を並べる。印を押すと済んだことになる。書いた人は消せる */
function ItemRows({
  items,
  detail,
  group,
  me,
}: {
  items: MemoryItem[];
  detail: MemoryDetail;
  group: GroupSummary | undefined;
  me: Me;
}) {
  const { update, remove } = useItemMutations(detail.memory.id);
  const today = useMemo(() => dayKeyIn(Date.now(), detail.memory.timeZone), [detail.memory.timeZone]);
  if (items.length === 0) return null;
  return (
    <ul>
      {items.map((item) => {
        const who =
          item.kind === "wish"
            ? group?.members.find((m) => m.id === item.createdBy)
            : group?.members.find((m) => m.id === item.assigneeId);
        const late = item.kind === "todo" && !item.doneAt && item.dueOn !== null && item.dueOn < today;
        return (
          <li
            key={item.id}
            className="grid min-h-[52px] grid-cols-[34px_1fr_auto] items-center gap-1 border-t border-line text-sm"
          >
            <Checkbox
              checked={Boolean(item.doneAt)}
              aria-label={`${item.title} を完了にする`}
              onCheckedChange={(v) => update.mutate({ id: item.id, done: v === true })}
              className="size-[22px] rounded-[7px]"
            />
            <span className="flex min-w-0 flex-col py-1">
              <b className={cn("font-medium", item.doneAt && "text-ink-2 line-through")}>{item.title}</b>
              {(item.place || item.dueOn) && (
                <small className={cn("text-[11px] text-ink-2", late && "font-bold text-sun")}>
                  {item.place}
                  {item.dueOn && `${formatShortDate(item.dueOn)} まで${late ? "・期限切れ" : ""}`}
                </small>
              )}
            </span>
            <span className="flex items-center gap-1">
              {who ? (
                <UserAvatar userId={who.id} groups={group ? [group] : []} me={me} />
              ) : (
                assigneeName(item, group) && <span className="text-[11px] text-ink-2">{assigneeName(item, group)}</span>
              )}
              {item.createdBy === me.user.id && (
                <button
                  type="button"
                  className="grid size-9 place-items-center text-ink-3"
                  aria-label={`${item.title} を削除`}
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 行を足す欄。Enter で足す。
 * @param dayIndex やりたいことの日。null は「通して」
 * @param group 担当を選ばせるときのグループ
 * @param withDue 期限を選ばせる
 */
function AddRow({
  detail,
  kind,
  dayIndex = null,
  placeholder,
  group,
  withDue,
}: {
  detail: MemoryDetail;
  kind: ItemKind;
  dayIndex?: number | null;
  placeholder: string;
  group?: GroupSummary;
  withDue?: boolean;
}) {
  const { add } = useItemMutations(detail.memory.id);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueOn, setDueOn] = useState("");
  const [open, setOpen] = useState(false);
  const shared = group && group.members.length > 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await add.mutateAsync({
      kind,
      title: title.trim(),
      dayIndex,
      place: place.trim() || null,
      assigneeId: assigneeId || null,
      dueOn: dueOn || null,
    });
    setTitle("");
    setPlace("");
    setDueOn("");
  }

  if (!open) {
    return (
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2.5 border-t border-line text-sm text-ink-2"
        onClick={() => setOpen(true)}
      >
        <span className="grid size-[22px] place-items-center rounded-[7px] border-2 border-dashed border-ink-3 text-ink-3">
          <Plus className="size-3.5" />
        </span>
        {placeholder}
      </button>
    );
  }
  return (
    <form className="flex flex-col gap-2 border-t border-line pt-2.5" onSubmit={submit}>
      <Input
        autoFocus
        value={title}
        maxLength={80}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {kind === "wish" && (
          <Input
            value={place}
            maxLength={60}
            placeholder="場所"
            aria-label="場所"
            className="flex-1"
            onChange={(e) => setPlace(e.target.value)}
          />
        )}
        {kind !== "wish" && shared && (
          <select
            aria-label="担当"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="min-h-11 flex-1 rounded-[14px] border border-line bg-field px-3 text-sm"
          >
            <option value="">みんな</option>
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        {withDue && (
          <Input
            type="date"
            value={dueOn}
            aria-label="期限"
            className="w-auto flex-1"
            onChange={(e) => setDueOn(e.target.value)}
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="min-h-10 px-3 text-sm text-ink-2" onClick={() => setOpen(false)}>
          やめる
        </button>
        <button
          type="submit"
          className="min-h-10 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
          disabled={!title.trim() || add.isPending}
        >
          追加
        </button>
      </div>
    </form>
  );
}
