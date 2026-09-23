import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultShareGroupId } from "@/lib/share-default";
import { useCreateList } from "./api";

/**
 * リストを作るシート。F-201
 * 名前とグループを入れ、日付は省ける。作ったら、そのリストの画面へ移る。
 * @param defaultGroupId 最初に選ぶグループ。無ければ自分だけ
 */
export function CreateListSheet({
  groups,
  me,
  defaultGroupId,
  onClose,
}: {
  groups: GroupSummary[];
  me: Me;
  defaultGroupId?: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const createList = useCreateList();

  const [groupId, setGroupId] = useState(
    defaultShareGroupId(groups, defaultGroupId, {
      groupId: me.settings.usualShareGroupId,
      extensionKey: "lists",
      alwaysOn: false,
    }),
  );
  // いつもの共有先から選ばれたことが分かる印を出す。0063、F-40
  const usualDefault = groupId === me.settings.usualShareGroupId;
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = title.trim().length > 0 && Boolean(groupId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      const created = await createList.mutateAsync({ groupId, title: title.trim(), date: date || null });
      onClose();
      navigate(`/lists/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet title="リストを作る" onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="名前">
          {(p) => (
            <Input
              {...p}
              autoFocus
              value={title}
              maxLength={50}
              placeholder="買い物、旅行の持ち物"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <SharePickerRow
          groups={groups}
          me={me}
          value={groupId}
          onChange={setGroupId}
          noneLabel="自分だけ"
          usualDefault={usualDefault}
        />
        <Field label="日付" hint="付けると、その日のカレンダーに出ます。省けます">
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            やめる
          </Button>
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? "作っています" : "作る"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
