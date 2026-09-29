import { type FormEvent, useState } from "react";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SheetFooterActions } from "@/components/parts/SheetFooterActions";
import { useSheetSubmit } from "@/components/parts/use-sheet-submit";
import { Input } from "@/components/ui/input";
import type { ListItem } from "./api";
import { useUpdateItemText } from "./api";

/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const EDIT_ITEM_FORM_ID = "edit-list-item-form";

/**
 * 項目の文字を直す、消すシート。0044、0093、issue #243
 *
 * ラボの「新しい見た目」・スマホだけで、押した行がそのまま広がって開く(row-expand、呼び出し側の
 * ListDetailPage が RowExpandContext に積む)。入れていない人・PC は、これまでどおり行の文字を
 * 押すとその場で入力欄になる(ListDetailPage の inline edit)。この画面はそちらでは開かない。
 *
 * @param onDelete 「消す」を押したとき。5 秒の「元に戻す」は呼び出し側(ListDetailPage)に任せる
 */
export function EditItemSheet({
  listId,
  item,
  onClose,
  onDelete,
}: {
  listId: string;
  item: ListItem;
  onClose: () => void;
  onDelete: (item: ListItem) => void;
}) {
  const updateText = useUpdateItemText(listId);
  const [text, setText] = useState(item.text);
  const { open, busy, error, submit: submitSheet, close, closeAndThen, handleClosed } = useSheetSubmit(onClose);

  const canSubmit = text.trim().length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await submitSheet(async () => {
      const value = text.trim();
      if (value !== item.text) await updateText.mutateAsync({ id: item.id, text: value });
    });
  }

  function remove() {
    closeAndThen(() => onDelete(item));
  }

  return (
    <ResponsiveSheet
      title="項目を直す"
      open={open}
      onOpenChange={close}
      onClose={handleClosed}
      footer={
        <SheetFooterActions
          formId={EDIT_ITEM_FORM_ID}
          busy={busy}
          canSubmit={canSubmit}
          onCancel={close}
          onDelete={remove}
        />
      }
    >
      <form id={EDIT_ITEM_FORM_ID} className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="項目">
          {(p) => <Input {...p} autoFocus value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
