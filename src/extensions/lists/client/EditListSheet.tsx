import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SheetFooterActions } from "@/components/parts/SheetFooterActions";
import { useSheetSubmit } from "@/components/parts/use-sheet-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListSummary } from "./api";
import { useDeleteList, usePatchList } from "./api";

/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const EDIT_LIST_FORM_ID = "edit-list-form";

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
  const [confirm, setConfirm] = useState(false);
  // シート全体(直す・消す確認の両方)が開いているか・送信中か・失敗。0081
  const { open, busy, error, setError, submit: submitSheet, close, handleClosed } = useSheetSubmit(onClose);

  const canSubmit = title.trim().length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await submitSheet(async () => {
      await patchList.mutateAsync({ title: title.trim(), date: date || null });
      toast("リストを直しました");
    });
  }

  /**
   * 消す。消すと、開いているリストの画面自体が読めなくなり、一覧へ移る。
   * 移る先で `ResponsiveSheet` はどのみち画面の木から外れるため、閉じる動きは待たない。#192
   */
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
        open={open}
        onOpenChange={close}
        onClose={handleClosed}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              やめる
            </Button>
            <Button variant="destructive" onClick={remove}>
              消す
            </Button>
          </div>
        }
      >
        {null}
      </ResponsiveSheet>
    );
  }

  return (
    <ResponsiveSheet
      title="リストを直す"
      open={open}
      onOpenChange={close}
      onClose={handleClosed}
      footer={
        <SheetFooterActions
          formId={EDIT_LIST_FORM_ID}
          busy={busy}
          canSubmit={canSubmit}
          onCancel={close}
          onDelete={() => setConfirm(true)}
        />
      }
    >
      <form id={EDIT_LIST_FORM_ID} className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="名前">
          {(p) => <Input {...p} value={title} maxLength={50} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="日付" hint="付けると、その日のカレンダーに出ます。空にすると外れます">
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
