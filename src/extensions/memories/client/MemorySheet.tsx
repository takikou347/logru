import { BookOpen } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { GroupSummary, Me } from "../../../shared/api-types";
import { Chip } from "@/components/Chip";
import { Field } from "@/components/Field";
import { Dot, FieldMessage, PanelRow } from "@/components/Panel";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { groupColor } from "@/lib/colors";
import { dateKey } from "@/lib/dates";
import { addDaysToKey, daysBetween, dayKeyIn, MAX_MEMORY_DAYS } from "../shared/days";
import type { Memory } from "../shared/types";
import { useInvalidateMemories, useSaveMemory } from "./api";

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
  const shared = groups.filter((g) => !g.isPersonal);
  const personal = groups.find((g) => g.isPersonal);
  const tz = memory?.timeZone ?? deviceTimeZone();
  const start = memory ? dayKeyIn(memory.startsAt, tz) : dateKey(defaultDay ?? new Date());
  const [title, setTitle] = useState(memory?.title ?? "");
  const [place, setPlace] = useState(memory?.place ?? "");
  const [firstDay, setFirstDay] = useState(start);
  const [lastDay, setLastDay] = useState(memory ? dayKeyIn(memory.endsAt - 1, tz) : start);
  const [groupId, setGroupId] = useState(
    memory?.groupId ?? (groups.some((g) => g.id === defaultGroupId) ? defaultGroupId! : (shared[0]?.id ?? personal?.id ?? "")),
  );
  const [komaEnabled, setKomaEnabled] = useState(memory?.komaEnabled ?? false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const length = daysBetween(firstDay, lastDay) + 1;
  const canDelete = memory && memory.createdBy === me.user.id;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("題名を入力してください。");
    if (length < 1 || length > MAX_MEMORY_DAYS) return setError(`期間は 1 日から ${MAX_MEMORY_DAYS} 日までです。終わりの日は始まりの日以降にしてください。`);
    try {
      const body = { title: title.trim(), place: place.trim() || null, firstDay, lastDay, komaEnabled, ...(memory ? {} : { groupId, timeZone: tz }) };
      const saved = await save.mutateAsync({ id: memory?.id, body });
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
      await api(`/memories/${memory.id}`, { method: "DELETE" });
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
        <Button type="button" variant="secondary" className="self-start" onClick={() => (onClose(), navigate(`/memories/${memory.id}`))}>
          <BookOpen className="size-4" />
          思い出を開く
        </Button>
      )}
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="題名">{(p) => <Input {...p} value={title} maxLength={60} placeholder="例: 箱根 1 泊" onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="場所">{(p) => <Input {...p} value={place} maxLength={60} placeholder="例: 箱根" onChange={(e) => setPlace(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-2">
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
          <Field label="終わりの日">{(p) => <Input {...p} type="date" value={lastDay} min={firstDay} onChange={(e) => setLastDay(e.target.value)} />}</Field>
        </div>
        <FieldMessage>{length >= 1 ? (length === 1 ? "日帰り" : `${length - 1} 泊 ${length} 日`) : "終わりの日は始まりの日以降にしてください。"}</FieldMessage>
        {!memory && (
          <PanelRow>
            <span>共有</span>
            <span className="flex max-w-[70%] flex-wrap justify-end gap-1.5" role="radiogroup" aria-label="共有するグループ">
              {groups.map((g) => (
                <Chip key={g.id} role="radio" aria-checked={groupId === g.id} onClick={() => setGroupId(g.id)}>
                  <Dot color={groupColor(g, me.colorPrefs)} />
                  {g.isPersonal ? "共有しない" : g.name}
                </Chip>
              ))}
            </span>
          </PanelRow>
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
