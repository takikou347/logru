import type { DayItem, ItemEditorProps, ItemEditScope } from "@extensions/client/types";
import type { Attendee, AttendeeResponse, CalendarItem } from "@shared/api-types";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
// biome-ignore lint/style/noRestrictedImports: エラーの型 ApiError だけを使う。api() 本体は ./api から呼ぶ
import { ApiError } from "@/api/client";
import { Notice } from "@/components/layout/AuthShell";
import { Field } from "@/components/parts/Field";
import { Dot, FieldMessage, PanelRow } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { groupColor, memberColor } from "@/lib/colors";
import {
  addDays,
  DAY_MS,
  dateKey,
  formatTime,
  holidayName,
  parseDateKey,
  startOfDay,
  toTimeInput,
  withTime,
} from "@/lib/dates";
import { vibrateShort } from "@/lib/haptics";
import { useOnline } from "@/lib/online";
import { cn } from "@/lib/utils";
import { markJustAdded } from "@/modules/calendar/recent-items";
import { itemKey } from "@/modules/calendar/use-undoable-delete";
import { canDeleteEvent, canEditEvent, canRespond, inviteeIds } from "../shared/permissions";
import { createEvent, respondToEvent, updateEvent } from "./api";
import { AttendeeList, InvitePicker, RsvpBar } from "./Invitees";
import { RepeatFields, repeatDraftFromRule, repeatDraftToInput } from "./RepeatFields";
import { ScopeDialog } from "./ScopeDialog";

/**
 * 新しい予定の始まりの時刻。今日なら次の正時、ほかの日なら 9 時。
 * @param date 予定を足す日
 */
function defaultStart(date: Date): number {
  const now = new Date();
  if (startOfDay(date).getTime() === startOfDay(now).getTime()) {
    return withTime(date, `${String(Math.min(now.getHours() + 1, 23)).padStart(2, "0")}:00`);
  }
  return withTime(date, "09:00");
}

/**
 * 新しい予定のシートの上に出す、その日に既にある予定。押すと、その予定を直すシートに切り替わる。0012
 * @param day 予定を足す日。見出しに使う
 */
function DayItemList({ day, items, onOpen }: { day: Date; items: DayItem[]; onOpen: (item: CalendarItem) => void }) {
  const heading = `${day.getMonth() + 1}月${day.getDate()}日の予定`;
  return (
    <section aria-label={heading} className="rounded-2xl bg-field px-3.5 py-2">
      <h3 className="pt-0.5 text-xs font-bold text-ink-2">{heading}</h3>
      <ul className="flex min-w-0 flex-col">
        {items.map((i) => (
          <li key={`${i.extension}:${i.id}`} className="border-line not-first:border-t">
            <button
              type="button"
              className="grid min-h-10 w-full grid-cols-[42px_1fr] items-center gap-1 py-0.5 text-left"
              onClick={() => onOpen(i)}
            >
              <time className="text-[13px] font-medium text-ink-2">{i.allDay ? "終日" : formatTime(i.startsAt)}</time>
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Dot color={i.color} response={i.myResponse} />
                <span className={cn("truncate", i.myResponse === "declined" && "text-ink-3 line-through")}>
                  {i.title}
                </span>
                <span className="ml-auto flex-none pl-1.5 text-[11px] font-normal text-ink-2">{i.groupName}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 予定を足す、直すシート。F-05〜F-07
 *
 * 終日なら始まりの日と終わりの日、そうでなければ日付と時刻を聞く。
 * 終わりの時刻が始まりより前なら、日をまたいだとみなす。
 * 新しく足すときは、その日に既にある予定をフォームの上に並べる。
 * 共有は「共有しない」が既定。グループで絞っていたら、そのグループを選んで開く。
 *
 * 共有のグループを選ぶと、そのメンバーから招待する人を選べる。#28
 * 招待された人が開くと、上に返事の欄を出す。招待された人も、作った人と同じように直せる。
 * グループを変えることと、予定を消すことは、作った人だけができる。
 * 招待されていないメンバーが開くと、見るだけのシートになる。
 *
 * 保存に失敗しても閉じず、入れた内容を残す。通信が切れている間は、入力だけさせて保存を止める。
 * 直している間にほかの人が消していたら、閉じて知らせる。0025
 */
export function EventSheet({
  target,
  dayItemsOf,
  onOpenItem,
  groups,
  me,
  onClose,
  onDelete,
  addons = [],
}: ItemEditorProps) {
  const qc = useQueryClient();
  const editing = target.mode === "edit" ? target.item : null;
  const myId = me.user.id;
  const creatorId = editing ? editing.createdBy : myId;
  const isCreator = creatorId === myId;
  const canEdit = !editing || canEditEvent(editing, myId);
  const canDelete = editing ? canDeleteEvent(editing, myId) : false;
  const personal = groups.find((g) => g.isPersonal);

  const initialStart = editing ? editing.startsAt : defaultStart(target.mode === "new" ? target.date : new Date());
  const initialEnd = editing ? editing.endsAt : initialStart + 60 * 60 * 1000;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [startDate, setStartDate] = useState(dateKey(new Date(initialStart)));
  const [endDate, setEndDate] = useState(() => {
    if (editing?.allDay && editing.endsAt) return dateKey(new Date(editing.endsAt - DAY_MS));
    return dateKey(new Date(initialStart));
  });
  const [startTime, setStartTime] = useState(toTimeInput(initialStart));
  const [endTime, setEndTime] = useState(initialEnd ? toTimeInput(initialEnd) : "");
  // 選んだグループ。選んでいなければ空で、自分だけのグループを使う。
  // グループの一覧は、シートを開いた後に届くことがある。開いた時点の値で決め打ちしない
  const [pickedGroupId, setGroupId] = useState(
    editing?.groupId ?? (target.mode === "new" ? target.groupId : undefined) ?? "",
  );
  const groupId = pickedGroupId || personal?.id || groups[0]?.id || "";
  const chosen = groups.find((g) => g.id === groupId);
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [repeat, setRepeat] = useState(() => repeatDraftFromRule(editing?.repeat, new Date(initialStart)));
  // 繰り返す予定を開いたときだけ、直す・消すときに範囲を挟む。0043
  const needsScope = Boolean(editing?.repeat);
  const [scopeAction, setScopeAction] = useState<"edit" | "delete" | null>(null);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const online = useOnline();
  // ほかの拡張が足した欄の、保存した後の仕事。0019
  const afterSaves = useRef(new Set<(itemId: string) => Promise<void>>());
  const register = useCallback((fn: (itemId: string) => Promise<void>) => {
    afterSaves.current.add(fn);
    return () => void afterSaves.current.delete(fn);
  }, []);
  // 新しく作るときは、選んでいる日の予定を並べる。日付を変えたら、その日の予定に切り替える
  const listDay = target.mode === "new" ? (parseDateKey(startDate) ?? target.date) : null;
  const dayItems = listDay && dayItemsOf ? dayItemsOf(listDay) : [];

  // 招待。作った人はいつも参加するので、選ぶ対象にも送る値にも入れない。#28
  const [attendees, setAttendees] = useState<Attendee[]>(editing?.attendees ?? []);
  const [invited, setInvited] = useState<Set<string>>(
    () =>
      new Set(
        inviteeIds(
          (editing?.attendees ?? []).map((a) => a.userId),
          creatorId,
        ),
      ),
  );
  const [response, setResponse] = useState<AttendeeResponse | undefined>(editing?.myResponse);
  const [responding, setResponding] = useState(false);
  const shared = chosen && !chosen.isPersonal ? chosen : null;
  const toPerson = (id: string) => {
    const m = chosen?.members.find((x) => x.id === id);
    return m
      ? {
          id: m.id,
          name: m.name,
          color: memberColor(m.id, m.userColor, me.colorPrefs),
          isMe: m.id === myId,
          avatarUrl: m.avatarUrl,
        }
      : null;
  };
  const candidates = (shared?.members ?? [])
    .filter((m) => m.id !== creatorId)
    .map((m) => toPerson(m.id)!)
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, "ja"));
  // グループを変えたら、そのグループにいない人は選んでいないことにする
  const effectiveInvited = new Set(candidates.filter((c) => invited.has(c.id)).map((c) => c.id));
  const attendeePeople = attendees.flatMap((a) => {
    const p = toPerson(a.userId);
    return p ? [{ ...p, response: a.response }] : [];
  });
  const inviter = creatorId ? toPerson(creatorId) : null;
  const showRsvp = editing && response && canRespond({ createdBy: editing.createdBy, attendees }, myId);

  /** 招待に返事をする。押した瞬間にカレンダーにも効かせる */
  async function respond(next: "accepted" | "declined") {
    if (!editing || next === response) return;
    setResponding(true);
    try {
      const item = await respondToEvent(editing.id, next);
      setResponse(item.myResponse);
      setAttendees(item.attendees ?? []);
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      toast(next === "accepted" ? "参加すると返しました" : "参加しないと返しました");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResponding(false);
    }
  }

  const start = parseDateKey(startDate);
  const hol = start ? holidayName(start) : null;

  /**
   * 入れた日付と時刻を、送る形にする。
   * @throws 日付が無いときと、終わりの日が始まりより前のとき
   */
  function times(): { startsAt: number; endsAt: number | null } {
    const s = parseDateKey(startDate);
    if (!s) throw new Error("日付を入れてください。");
    if (allDay) {
      const e = parseDateKey(endDate) ?? s;
      if (e < s) throw new Error("終わりの日は始まりの日より後にしてください。");
      return { startsAt: s.getTime(), endsAt: addDays(e, 1).getTime() };
    }
    const startsAt = withTime(s, startTime || "09:00");
    let endsAt: number | null = endTime ? withTime(s, endTime) : null;
    if (endsAt != null && endsAt < startsAt) endsAt += DAY_MS;
    return { startsAt, endsAt };
  }

  /** いまの入力の日時。足された欄に渡す。入力が途中なら、選んでいる日の終日として扱う */
  function draftTimes(): { startsAt: number; endsAt: number | null } {
    try {
      return times();
    } catch {
      const d = parseDateKey(startDate) ?? (target.mode === "new" ? target.date : new Date());
      return { startsAt: startOfDay(d).getTime(), endsAt: addDays(startOfDay(d), 1).getTime() };
    }
  }

  /** 実際に保存する。繰り返す予定を直すときは、範囲(scope)を添える。0043 */
  async function persist(payload: Record<string, unknown>, scope?: ItemEditScope) {
    setBusy(true);
    try {
      const opts = scope ? { occurrenceAt: editing?.occurrenceAt, scope } : {};
      const saved = editing ? await updateEvent(editing.id, payload, opts) : await createEvent(payload);
      // 足された欄の仕事は、予定の保存が済んでから行う。失敗しても予定は保存できている
      await Promise.all([...afterSaves.current].map((fn) => fn(saved.id).catch((e: Error) => toast.error(e.message))));
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      if (!editing) {
        // 新しく足したチップだけ、膨らんで入る動きにする。直したときは動かさない。0044、0048、#98、#112
        markJustAdded(itemKey(saved));
        vibrateShort();
      }
      toast(editing ? "予定を保存しました" : "予定を足しました");
      onClose();
    } catch (err) {
      if (editing && err instanceof ApiError && err.status === 404) {
        await qc.invalidateQueries({ queryKey: ["calendar"] });
        toast.error("この予定は消されています");
        onClose();
        return;
      }
      // 入力の誤りでなければ、入れた内容が残っていることも伝える
      const retryable = err instanceof ApiError && (err.status === 0 || err.status >= 500);
      setError(retryable ? `保存できませんでした。入れた内容はそのままです。${err.message}` : (err as Error).message);
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let when: { startsAt: number; endsAt: number | null };
    try {
      when = times();
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const payload = {
      title: title.trim(),
      allDay,
      memo: memo.trim() || null,
      groupId,
      ...when,
      // 共有しない予定は、自分だけ。招待は送らない
      attendeeIds: shared ? [...effectiveInvited] : [],
      repeat: repeatDraftToInput(repeat),
    };
    // 既に繰り返している予定を直すときは、この回だけ・これ以降・全部を先に選ばせる。0043
    if (needsScope) {
      setPendingPayload(payload);
      setScopeAction("edit");
      return;
    }
    void persist(payload);
  }

  /** 範囲の確認を選んだとき。edit なら保留していた保存を、delete なら消す処理を続きから行う */
  function confirmScope(scope: ItemEditScope) {
    const action = scopeAction;
    setScopeAction(null);
    if (action === "delete") {
      if (editing) {
        onDelete(editing, scope);
        onClose();
      }
      return;
    }
    if (action === "edit" && pendingPayload) void persist(pendingPayload, scope);
    setPendingPayload(null);
  }

  return (
    <ResponsiveSheet title={!editing ? "新しい予定" : canEdit ? "予定を直す" : "予定"} onClose={onClose}>
      {listDay && dayItems.length > 0 && onOpenItem && (
        <DayItemList day={listDay} items={dayItems} onOpen={onOpenItem} />
      )}
      {showRsvp && (
        <RsvpBar
          color={chosen ? groupColor(chosen, me.colorPrefs) : "nezumi"}
          inviter={inviter}
          response={response}
          busy={responding}
          onRespond={respond}
        />
      )}
      {!canEdit && <Notice>この予定は見るだけです。直せるのは、作った人と招待された人です。</Notice>}
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        {/* 見るだけのときは、入力をまとめて押せなくする */}
        <fieldset disabled={!canEdit} className="contents">
          <Field label="題名">
            {(p) => (
              <Input
                {...p}
                value={title}
                maxLength={100}
                placeholder="例: 歯医者"
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <PanelRow>
            <span>終日</span>
            <Switch checked={allDay} onCheckedChange={setAllDay} aria-label="終日" disabled={!canEdit} />
          </PanelRow>
          <Field label={allDay ? "始まりの日" : "日付"} hint={hol ?? undefined}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            )}
          </Field>
          {allDay && (
            <Field label="終わりの日">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              )}
            </Field>
          )}
          {!allDay && (
            <>
              <Field label="始まり">
                {(p) => <Input {...p} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
              </Field>
              <Field label="終わり">
                {(p) => <Input {...p} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
              </Field>
            </>
          )}
          <RepeatFields value={repeat} onChange={setRepeat} />
          <div className="flex flex-col gap-1.5">
            <SharePickerRow groups={groups} me={me} value={groupId} onChange={setGroupId} disabled={!isCreator} />
            <FieldMessage>
              {shared ? `「${shared.name}」のメンバー全員に見えます。` : "自分だけに見えます。"}
              {canEdit && !isCreator && " グループを変えられるのは、作った人だけです。"}
            </FieldMessage>
          </div>
          {editing && shared && attendeePeople.length > 1 && (
            <AttendeeList people={attendeePeople} createdBy={creatorId} />
          )}
          {shared && canEdit && (
            <InvitePicker candidates={candidates} selected={effectiveInvited} onChange={setInvited} />
          )}
          {addons.map((Addon, i) => (
            <Addon
              key={i}
              draft={{ id: editing?.id ?? null, groupId, allDay, ...draftTimes() }}
              register={register}
              disabled={!canEdit}
            />
          ))}
          <Field label="メモ">
            {(p) => (
              <Textarea
                {...p}
                value={memo}
                maxLength={1000}
                placeholder={canEdit ? "お店の名前や持ち物" : undefined}
                onChange={(e) => setMemo(e.target.value)}
              />
            )}
          </Field>
        </fieldset>
        {canEdit && !online && (
          <Notice role="status">
            <b>オフラインです。</b>入れた内容はこのまま残ります。つながると保存できます。
          </Notice>
        )}
        {error && online && <Notice error>{error}</Notice>}
        {canEdit ? (
          <div className="flex justify-between gap-2">
            {editing && canDelete ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (needsScope) {
                    setScopeAction("delete");
                    return;
                  }
                  onDelete(editing);
                  onClose();
                }}
              >
                予定を消す
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={onClose}>
                やめる
              </Button>
            )}
            <Button type="submit" disabled={busy || !online || !title.trim() || !groupId}>
              {busy ? "保存しています" : "保存する"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          </div>
        )}
      </form>
      {scopeAction && (
        <ScopeDialog
          action={scopeAction}
          onChoose={confirmScope}
          onClose={() => {
            setScopeAction(null);
            setPendingPayload(null);
          }}
        />
      )}
    </ResponsiveSheet>
  );
}
