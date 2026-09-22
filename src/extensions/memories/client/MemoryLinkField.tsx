import type { ItemAddonProps } from "@extensions/client/types";
import { useEffect, useRef, useState } from "react";
import { PanelRow } from "@/components/parts/Panel";
import { Switch } from "@/components/ui/switch";
import { candidatesOf, memoryOfEvent } from "../shared/links";
import { useInvalidateMemories, useLinkEventToMemory, useMemoryGroups, useMemoryList } from "./api";

/**
 * 予定のシートに足す「思い出に入れる」の欄。0020
 * 予定の日時とグループに重なる思い出があるときだけ出す。最初は入れる。切ると、その思い出から外す。
 * 保存は、予定の保存が済んでから行う。
 */
export function MemoryLinkField({ draft, register, disabled }: ItemAddonProps) {
  const { groups } = useMemoryGroups();
  const usable = groups.some((g) => g.id === draft.groupId);
  const list = useMemoryList(usable ? draft.groupId : null);
  const invalidate = useInvalidateMemories();
  const linkEvent = useLinkEventToMemory();
  const memories = usable ? (list.data?.memories ?? []).filter((m) => m.groupId === draft.groupId) : [];
  const probe = { id: draft.id ?? "", groupId: draft.groupId, startsAt: draft.startsAt, endsAt: draft.endsAt };
  const candidate = candidatesOf(probe, memories)[0];
  const current = draft.id ? memoryOfEvent(probe, memories) : candidate;
  const target = current ?? candidate;
  const [picked, setPicked] = useState<boolean | null>(null);
  const included = picked ?? (draft.id ? current !== undefined : true);

  // 保存した後に、入れるか外すかを送る。変えていなければ送らない
  const state = useRef({ target, included, changed: false });
  state.current = { target, included, changed: picked !== null || (!draft.id && included === false) };
  useEffect(
    () =>
      register(async (itemId) => {
        const { target: m, included: on, changed } = state.current;
        if (!m || !changed) return;
        await linkEvent.mutateAsync({ memoryId: m.id, itemId, included: on });
        await invalidate();
      }),
    [register, invalidate, linkEvent],
  );

  if (!target) return null;
  return (
    <PanelRow>
      <span className="py-2">
        思い出に入れる
        <br />
        <span className="text-xs text-ink-2">{target.title}</span>
      </span>
      <Switch
        checked={included}
        disabled={disabled}
        aria-label={`「${target.title}」に入れる`}
        onCheckedChange={setPicked}
      />
    </PanelRow>
  );
}
