import { useState } from "react";
import { toast } from "sonner";
import type { GroupSummary, Me } from "@shared/api-types";
import { Chip } from "@/components/parts/Chip";
import { Dot, FieldMessage, PanelRow } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { groupColor } from "@/lib/colors";
import { startOfDayIn } from "../shared/days";
import { useInvalidateMemories, useMemoryList } from "./api";
import { deviceTimeZone, useSaveKomaDay } from "./koma-api";

/**
 * ひとコマを始める、つなぎ直すシート。グループと、その日を含む思い出を選ぶ。F-127、F-129
 * @param day その日。`2026-09-22`
 * @param current いまのつなぎ。始める前は無い
 */
export function KomaLinkSheet({
  day,
  groups,
  me,
  current,
  onClose,
}: {
  day: string;
  groups: GroupSummary[];
  me: Me;
  current?: { groupId: string; memoryId: string | null; timeZone: string };
  onClose: () => void;
}) {
  const personal = groups.find((g) => g.isPersonal);
  const [groupId, setGroupId] = useState(current?.groupId ?? personal?.id ?? groups[0]?.id ?? "");
  const [memoryId, setMemoryId] = useState<string | null>(current?.memoryId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidateMemories();
  const saveKomaDay = useSaveKomaDay();
  const list = useMemoryList(groupId || null);
  const tz = current?.timeZone ?? deviceTimeZone();
  const dayStart = startOfDayIn(day, tz);
  const choices = (list.data?.memories ?? []).filter((m) => m.groupId === groupId && m.startsAt <= dayStart && m.endsAt > dayStart);
  const changed = current && current.groupId !== groupId;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveKomaDay.mutateAsync({ day, groupId, memoryId: choices.some((m) => m.id === memoryId) ? memoryId : null, timeZone: tz });
      await invalidate();
      toast(current ? "保存しました" : "今日のひとコマを始めました");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveSheet
      title={current ? "共有先と思い出を変える" : "今日のひとコマを始める"}
      description={current ? undefined : "今日の 7 時から 22 時台まで、1 時間に 1 枚ずつ写真を残せます。"}
      onClose={onClose}
    >
      <PanelRow>
        <span>共有</span>
        <span className="flex max-w-[70%] flex-wrap justify-end gap-1.5" role="radiogroup" aria-label="共有するグループ">
          {groups.map((g) => (
            <Chip
              key={g.id}
              role="radio"
              aria-checked={groupId === g.id}
              onClick={() => {
                setGroupId(g.id);
                setMemoryId(null);
              }}
            >
              <Dot color={groupColor(g, me.colorPrefs)} />
              {g.isPersonal ? "自分だけ" : g.name}
            </Chip>
          ))}
        </span>
      </PanelRow>
      <PanelRow>
        <label htmlFor="koma-memory">思い出</label>
        <select id="koma-memory" value={memoryId ?? ""} onChange={(e) => setMemoryId(e.target.value || null)} className="min-h-11 max-w-[60%] bg-transparent text-right text-sm">
          <option value="">選ばない</option>
          {choices.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </PanelRow>
      {changed && <FieldMessage>共有先を変えると、この日のひとコマを見られる人も変わります。</FieldMessage>}
      {error && <FieldMessage error>{error}</FieldMessage>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          やめる
        </Button>
        <Button className="flex-1" onClick={save} disabled={saving || !groupId}>
          {current ? "保存する" : "始める"}
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
