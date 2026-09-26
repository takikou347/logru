import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { SheetFooterActions } from "@/components/parts/SheetFooterActions";
import { useSheetSubmit } from "@/components/parts/use-sheet-submit";
import { Input } from "@/components/ui/input";
import { defaultShareGroupId } from "@/lib/share-default";
import { useCreateList } from "./api";

/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const CREATE_LIST_FORM_ID = "create-list-form";

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
  // 開いているか・送信中か・失敗を、シートの骨組みとしてまとめて持つ。0081
  const { open, busy, error, submit: submitSheet, close, closeAndThen, handleClosed } = useSheetSubmit(onClose);

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

  const canSubmit = title.trim().length > 0 && Boolean(groupId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await submitSheet(
      async () => {
        const created = await createList.mutateAsync({ groupId, title: title.trim(), date: date || null });
        // 閉じる動きが終わってから、作ったリストの画面へ移る。#192
        closeAndThen(() => navigate(`/lists/${created.id}`));
      },
      { keepOpen: true },
    );
  }

  return (
    <ResponsiveSheet
      title="リストを作る"
      open={open}
      onOpenChange={close}
      onClose={handleClosed}
      footer={
        <SheetFooterActions
          formId={CREATE_LIST_FORM_ID}
          busy={busy}
          canSubmit={canSubmit}
          submitLabel="作る"
          busyLabel="作っています"
          onCancel={close}
        />
      }
    >
      <form id={CREATE_LIST_FORM_ID} className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
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
          usualDefault={usualDefault}
          extensionLabel="リスト"
        />
        <Field label="日付" hint="付けると、その日のカレンダーに出ます。省けます">
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
