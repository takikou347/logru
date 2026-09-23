import type { CalendarItem, GroupSummary, Me } from "@shared/api-types";
import { BookOpen } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Field } from "@/components/parts/Field";
import { FieldMessage, PanelRow } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { dateKey, formatTime } from "@/lib/dates";
import { defaultShareGroupId } from "@/lib/share-default";
import { useCalendar } from "@/modules/calendar/api";
import { addDaysToKey, dayKeyIn, daysBetween, MAX_MEMORY_DAYS, startOfDayIn } from "../shared/days";
import { memoryOfEvent, overlaps } from "../shared/links";
import type { Memory } from "../shared/types";
import { useDeleteMemory, useInvalidateMemories, useLinkEventToMemory, useMemoryList, useSaveMemory } from "./api";

/** 端末の時間帯の名前 */
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";

/**
 * 思い出のシート。作る、編集する、削除する。F-101、F-107
 *
 * 期間は日付で選び、サーバーが時間帯での 0 時に直す。共有するグループは、作るときだけ選べる。
 * 削除できるのは作った人だけ。削除するとしおりは消えるが、記録と写真は残る。
 *
 * @param groups 思い出に使えるグループ
 * @param memory 編集する思い出。無ければ新しく作る
 * @param defaultGroupId 作るときに最初に選ぶグループ
 * @param defaultDay 作るときの始まりの日
 * @param openLink カレンダーから開いたとき。「思い出を開く」を出す
 */
export function MemorySheet({
  groups,
  me,
  memory,
  defaultGroupId,
  defaultDay,
  onClose,
  openLink = false,
}: {
  groups: GroupSummary[];
  me: Me;
  memory?: Memory;
  defaultGroupId?: string | null;
  defaultDay?: Date;
  onClose: () => void;
  openLink?: boolean;
}) {
  const navigate = useNavigate();
  const save = useSaveMemory();
  const invalidate = useInvalidateMemories();
  const linkEvent = useLinkEventToMemory();
  const deleteMemory = useDeleteMemory();
  const tz = memory?.timeZone ?? deviceTimeZone();
  const start = memory ? dayKeyIn(memory.startsAt, tz) : dateKey(defaultDay ?? new Date());
  const [title, setTitle] = useState(memory?.title ?? "");
  const [place, setPlace] = useState(memory?.place ?? "");
  const [firstDay, setFirstDay] = useState(start);
  const [lastDay, setLastDay] = useState(memory ? dayKeyIn(memory.endsAt - 1, tz) : start);
  const [groupId, setGroupId] = useState(
    memory?.groupId ??
      defaultShareGroupId(groups, defaultGroupId, {
        groupId: me.settings.usualShareGroupId,
        extensionKey: "memories",
        alwaysOn: false,
      }),
  );
  // 新しく作るときだけ、いつもの共有先から選ばれたことが分かる印を出す。0063、F-40
  const usualDefault = !memory && groupId === me.settings.usualShareGroupId;
  const [komaEnabled, setKomaEnabled] = useState(memory?.komaEnabled ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const length = daysBetween(firstDay, lastDay) + 1;
  const canDelete = memory && memory.createdBy === me.user.id;

  // 期間に重なる同じグループの予定。最初は入れておき、外したいものだけ外す。0020
  const validRange = length >= 1 && length <= MAX_MEMORY_DAYS;
  const range = validRange
    ? { startsAt: startOfDayIn(firstDay, tz), endsAt: startOfDayIn(addDaysToKey(lastDay, 1), tz) }
    : null;
  const calendar = useCalendar(range?.startsAt ?? 0, range?.endsAt ?? 1);
  const others = (useMemoryList(groupId || null).data?.memories ?? []).filter(
    (m) => m.groupId === groupId && m.id !== memory?.id,
  );
  const self = {
    id: memory?.id ?? "new",
    groupId,
    startsAt: range?.startsAt ?? 0,
    endsAt: range?.endsAt ?? 0,
    excludedEventIds: memory?.excludedEventIds ?? [],
  };
  const events: CalendarItem[] = range
    ? (calendar.data ?? []).filter((e) => e.extension === "events" && e.groupId === groupId && overlaps(e, self))
    : [];
  const [picked, setPicked] = useState<Map<string, boolean>>(new Map());
  const includedByDefault = (e: CalendarItem) => memoryOfEvent(e, [...others, self])?.id === self.id;
  const isIncluded = (e: CalendarItem) => picked.get(e.id) ?? includedByDefault(e);
  const takenBy = (e: CalendarItem) => (includedByDefault(e) ? undefined : memoryOfEvent(e, others));

  // 期間を変えたら、前は入っていて、新しい期間から外れる予定を知らせる
  const oldRange = memory ? { startsAt: memory.startsAt, endsAt: memory.endsAt } : null;
  const oldCalendar = useCalendar(oldRange?.startsAt ?? 0, oldRange?.endsAt ?? 1);
  const leaving =
    memory && range && (range.startsAt !== memory.startsAt || range.endsAt !== memory.endsAt)
      ? (oldCalendar.data ?? []).filter(
          (e) =>
            e.extension === "events" &&
            e.groupId === memory.groupId &&
            memoryOfEvent(e, [...others, memory])?.id === memory.id &&
            !overlaps(e, range),
        )
      : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("題名を入力してください。");
    if (length < 1 || length > MAX_MEMORY_DAYS)
      return setError(`期間は 1 日から ${MAX_MEMORY_DAYS} 日までです。終わりの日は始まりの日以降にしてください。`);
    try {
      const excludedEventIds = events.filter((e) => !isIncluded(e)).map((e) => e.id);
      const body = {
        title: title.trim(),
        place: place.trim() || null,
        firstDay,
        lastDay,
        komaEnabled,
        excludedEventIds,
        ...(memory ? {} : { groupId, timeZone: tz }),
      };
      const saved = await save.mutateAsync({ id: memory?.id, body });
      // ほかの思い出に入っていた予定を、ここで入れると決めたら、前の思い出から外す。予定は 1 つの思い出にだけ入る
      const moved = events.filter((e) => picked.get(e.id) === true && takenBy(e));
      await Promise.all(
        moved.map((e) => linkEvent.mutateAsync({ memoryId: takenBy(e)!.id, itemId: e.id, included: false })),
      );
      if (moved.length) await invalidate();
      toast(memory ? "思い出を保存しました" : "思い出を作りました");
      onClose();
      if (!memory) navigate(`/memories/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!memory) return;
    try {
      await deleteMemory.mutateAsync(memory.id);
      await invalidate();
      toast("思い出を削除しました。記録と写真は残っています");
      onClose();
      navigate("/memories", { replace: true });
    } catch (err) {
      setConfirm(false);
      setError((err as Error).message);
    }
  }

  if (confirm && memory) {
    return (
      <ResponsiveSheet
        title="思い出を削除しますか"
        description={`「${memory.title}」のしおりが消えます。元に戻せません。記録と写真 ${memory.photoCount} 枚は、その日のまま残ります。`}
        onClose={() => setConfirm(false)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            やめる
          </Button>
          <Button variant="destructive" onClick={remove}>
            削除する
          </Button>
        </div>
      </ResponsiveSheet>
    );
  }

  return (
    <ResponsiveSheet title={memory ? "思い出を編集" : "思い出を作る"} onClose={onClose}>
      {openLink && memory && (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => (onClose(), navigate(`/memories/${memory.id}`))}
        >
          <BookOpen className="size-4" />
          思い出を開く
        </Button>
      )}
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="題名">
          {(p) => (
            <Input
              {...p}
              value={title}
              maxLength={60}
              placeholder="例: 箱根 1 泊"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <Field label="場所">
          {(p) => (
            <Input
              {...p}
              value={place}
              maxLength={60}
              placeholder="例: 箱根"
              onChange={(e) => setPlace(e.target.value)}
            />
          )}
        </Field>
        <Field label="始まりの日">
          {(p) => (
            <Input
              {...p}
              type="date"
              value={firstDay}
              onChange={(e) => {
                const next = e.target.value;
                // 始まりの日を動かしたら、日数を保って終わりの日も動かす
                if (next) setLastDay(addDaysToKey(next, Math.max(0, length - 1)));
                setFirstDay(next);
              }}
            />
          )}
        </Field>
        <Field label="終わりの日">
          {(p) => (
            <Input {...p} type="date" value={lastDay} min={firstDay} onChange={(e) => setLastDay(e.target.value)} />
          )}
        </Field>
        <FieldMessage>
          {length >= 1
            ? length === 1
              ? "日帰り"
              : `${length - 1} 泊 ${length} 日`
            : "終わりの日は始まりの日以降にしてください。"}
        </FieldMessage>
        {!memory && (
          <SharePickerRow
            groups={groups}
            me={me}
            value={groupId}
            onChange={setGroupId}
            usualDefault={usualDefault}
            extensionLabel="思い出"
          />
        )}
        {events.length > 0 && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-medium text-ink-2">入れる予定</legend>
            {events.map((e) => {
              const other = takenBy(e);
              return (
                <label
                  key={e.id}
                  className="flex min-h-11 items-center gap-3 border-t border-line text-sm first-of-type:border-t-0"
                >
                  <Checkbox
                    checked={isIncluded(e)}
                    onCheckedChange={(v) => setPicked((m) => new Map(m).set(e.id, v === true))}
                    aria-label={`「${e.title}」を入れる`}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{e.title}</span>
                    <span className="text-[11px] text-ink-2">
                      {new Date(e.startsAt).getMonth() + 1}/{new Date(e.startsAt).getDate()}{" "}
                      {e.allDay ? "終日" : formatTime(e.startsAt)}
                      {other && !picked.has(e.id) && `・「${other.title}」に入っています`}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}
        {leaving.length > 0 && (
          <FieldMessage>
            期間から外れる予定: {leaving.map((e) => e.title).join("、")}。保存すると、この思い出には入らなくなります。
          </FieldMessage>
        )}
        <PanelRow>
          <span className="py-2">
            ひとコマ
            <br />
            <span className="text-xs text-ink-2">期間中の 7 時から 22 時台まで、1 時間に 1 枚ずつ写真を残します</span>
          </span>
          <Switch checked={komaEnabled} onCheckedChange={setKomaEnabled} aria-label="ひとコマを使う" />
        </PanelRow>
        {error && <FieldMessage error>{error}</FieldMessage>}
        <div className="flex gap-2">
          {canDelete ? (
            <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
              削除
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              やめる
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {memory ? "保存する" : "作る"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
