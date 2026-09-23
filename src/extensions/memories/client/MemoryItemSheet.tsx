import type { ItemEditorProps } from "@extensions/client/types";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Loading } from "@/app/guards";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { useMemory, useMemoryGroups } from "./api";
import { MemorySheet } from "./MemorySheet";

/**
 * カレンダーの思い出の項目を押したときのシート。0008
 * - 思い出の帯: 予定と同じく、その場で題名や期間を直せる。シートの中に「思い出を開く」を置く
 * - 日ごとの記録、日ごとのひとコマ(id が "r:" か "k:" で始まる。0056): シートを出さず、その日の画面へ移る
 */
export function MemoryItemSheet({ target, me, onClose }: ItemEditorProps) {
  const navigate = useNavigate();
  const item = target.mode === "edit" ? target.item : null;
  const recordsDay =
    item?.id.startsWith("r:") || item?.id.startsWith("k:") ? item.id.split(":").slice(2).join(":") : null;
  const id = item && !recordsDay ? item.id.slice(2) : "";
  const detail = useMemory(id, Boolean(id));
  const { groups } = useMemoryGroups();

  useEffect(() => {
    if (!item || !recordsDay) return;
    onClose();
    navigate(`/memories/on/${recordsDay}?group=${item.groupId}`);
  }, [item, recordsDay, navigate, onClose]);

  if (!item || recordsDay) return null;
  if (!detail.data) {
    return (
      <ResponsiveSheet title={item.title} onClose={onClose}>
        {detail.error ? <p className="text-sm text-ink-2">{detail.error.message}</p> : <Loading />}
      </ResponsiveSheet>
    );
  }
  return <MemorySheet groups={groups} me={me} memory={detail.data.memory} onClose={onClose} openLink />;
}
