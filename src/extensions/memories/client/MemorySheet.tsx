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
import { api } from "@/lib/api";
import { groupColor } from "@/lib/colors";
import { dateKey } from "@/lib/dates";
import { addDaysToKey, daysBetween, dayKeyIn, MAX_MEMORY_DAYS } from "../shared/days";
import type { Memory } from "../shared/types";
import { useInvalidateMemories, useSaveMemory } from "./api";

/** 端末の時間帯の名前 */
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";

/**
 * 思い出のシート。作る、直す、消す。F-101、F-107
 *
 * 期間は日付で選び、サーバーが時間帯での 0 時に直す。共有するグループは、作るときだけ選べる。
 * 消せるのは作った人だけ。消すとしおりは消えるが、記録と写真は残る。
 *
 * @param groups 思い出の拡張が有効なグループ
 * @param memory 直す思い出。無ければ新しく作る
 * @param defaultGroupId 作るときに最初に選ぶグループ
 * @param defaultDay 作るときの初日
 */
export function MemorySheet({
  groups,
  me,
  memory,
  defaultGroupId,
  defaultDay,
  onClose,
  extra,
}: {
  groups: GroupSummary[];
  me: Me;
  memory?: Memory;
  defaultGroupId?: string | null;
  defaultDay?: Date;
  onClose: () => void;
  /** 項目の下に足すもの。ひとコマの切り替えなど */
  extra?: (state: { komaEnabled: boolean; setKomaEnabled: (v: boolean) => void }) => React.ReactNode;
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
    if (!title.trim()) return setError("題名を入れてください。");
    if (length < 1 || length > MAX_MEMORY_DAYS) return setError(`期間は 1 日から ${MAX_MEMORY_DAYS} 日までです。終わりは始まりより後にしてください。`);
    try {
      const body = { title: title.trim(), place: place.trim() || null, firstDay, lastDay, komaEnabled, ...(memory ? {} : { groupId, timeZone: tz }) };
      const saved = await save.mutateAsync({ id: memory?.id, body });
      toast(memory ? "思い出を直しました" : "思い出を作りました");
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
      toast("思い出を消しました。記録と写真は残っています");
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
        title="思い出を消しますか"
        description={`「${memory.title}」のしおりが消えます。元に戻せません。記録と写真 ${memory.photoCount} 枚は、日付とグループに残ります。`}
        onClose={() => setConfirm(false)}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            やめる
          </Button>
          <Button variant="destructive" onClick={remove}>
            消す
          </Button>
        </div>
      </ResponsiveSheet>
    );
  }

  return (
    <ResponsiveSheet title={memory ? "思い出を直す" : "思い出を作る"} onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="題名">{(p) => <Input {...p} value={title} maxLength={60} placeholder="例: 箱根 1 泊" onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="場所" hint="省けます">
          {(p) => <Input {...p} value={place} maxLength={60} placeholder="例: 箱根" onChange={(e) => setPlace(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="初日">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={firstDay}
                onChange={(e) => {
                  const next = e.target.value;
                  // 初日を後ろへ動かしたら、日数を保って最後の日も動かす
                  if (next) setLastDay(addDaysToKey(next, Math.max(0, length - 1)));
                  setFirstDay(next);
                }}
              />
            )}
          </Field>
          <Field label="最後の日">{(p) => <Input {...p} type="date" value={lastDay} min={firstDay} onChange={(e) => setLastDay(e.target.value)} />}</Field>
        </div>
        <FieldMessage>{length >= 1 ? (length === 1 ? "日帰り" : `${length - 1} 泊 ${length} 日`) : "終わりは始まりより後にしてください。"}</FieldMessage>
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
        {extra?.({ komaEnabled, setKomaEnabled })}
        {error && <FieldMessage error>{error}</FieldMessage>}
        <div className="flex gap-2">
          {canDelete ? (
            <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
              消す
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              やめる
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {memory ? "直す" : "作る"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
