import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import type { ItemEditorProps } from "../../types.client";
import { GroupLabel, formatSpan } from "./parts";

/**
 * カレンダーの思い出の項目を押したときのシート。0008
 * - 思い出の帯: 題名、期間、場所と「開く」を出す。押すと思い出を開く
 * - 日ごとの記録: シートを出さず、その日の画面へ移る
 */
export function MemoryItemSheet({ target, groups, me, onClose }: ItemEditorProps) {
  const navigate = useNavigate();
  const item = target.mode === "edit" ? target.item : null;
  const recordsDay = item?.id.startsWith("r:") ? item.id.split(":").slice(2).join(":") : null;

  useEffect(() => {
    if (!item || !recordsDay) return;
    onClose();
    navigate(`/memories/on/${recordsDay}?group=${item.groupId}`);
  }, [item, recordsDay, navigate, onClose]);

  if (!item || recordsDay) return null;
  const id = item.id.slice(2);
  const group = groups.find((g) => g.id === item.groupId);
  return (
    <ResponsiveSheet title={item.title} onClose={onClose}>
      <p className="text-[22px] font-extrabold tracking-[-0.02em]">{formatSpan(item.startsAt, item.endsAt ?? item.startsAt + 1, Intl.DateTimeFormat().resolvedOptions().timeZone)}</p>
      <div className="flex flex-wrap items-center gap-3">
        <GroupLabel group={group} me={me} />
        {item.place && <span className="text-xs text-ink-2">{item.place}</span>}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>
          閉じる
        </Button>
        <Button className="flex-1" onClick={() => (onClose(), navigate(`/memories/${id}`))}>
          開く
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
