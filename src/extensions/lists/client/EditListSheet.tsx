import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListSummary } from "./api";
import { useDeleteList, usePatchList } from "./api";

/**
 * リストの名前と日付を直す、リストを消すシート。F-206、F-208
 * 消す前に、元に戻せないことを確かめる画面を挟む。
 */
export function EditListSheet({ list, onClose }: { list: ListSummary; onClose: () => void }) {
  const navigate = useNavigate();
  const patchList = usePatchList(list.id);
  const deleteList = useDeleteList();
  const [title, setTitle] = useState(list.title);
  const [date, setDate] = useState(list.date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const canSubmit = title.trim().length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await patchList.mutateAsync({ title: title.trim(), date: date || null });
      toast("リストを直しました");
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await deleteList.mutateAsync(list.id);
      toast("リストを消しました");
      onClose();
      navigate("/lists", { replace: true });
    } catch (err) {
      setConfirm(false);
      setError((err as Error).message);
    }
  }

  if (confirm) {
    return (
      <ResponsiveSheet
        title="リストを消しますか"
        description={`「${list.title}」と、中の項目がすべて消えます。元に戻せません。`}
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
    <ResponsiveSheet title="リストを直す" onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="名前">
          {(p) => <Input {...p} value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="日付" hint="付けると、その日のカレンダーに出ます。空にすると外れます">
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="danger" onClick={() => setConfirm(true)}>
            消す
          </Button>
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? "保存しています" : "保存する"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
