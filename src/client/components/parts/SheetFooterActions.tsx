/**
 * 送るシートの下に留める行。「やめる」か「消す」、右に「保存する」。`ResponsiveSheet` の `footer` に渡す。0081、issue #207
 *
 * `onDelete` を渡すと左は「消す」(danger)になる。渡さなければ「やめる」(ghost)。
 * `extra` を渡すと、この行の下にもう 1 段(「続けて記録」など)を積む。
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function SheetFooterActions({
  formId,
  busy,
  canSubmit = true,
  submitLabel = "保存する",
  busyLabel = "保存しています",
  cancelLabel = "やめる",
  deleteLabel = "消す",
  onCancel,
  onDelete,
  extra,
}: {
  /** 保存ボタンから submit する form の id */
  formId: string;
  busy: boolean;
  /** 足りない入力があるとき false にする。省けば常に押せる(押した時点で確かめる画面もある) */
  canSubmit?: boolean;
  submitLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
  deleteLabel?: string;
  /** 「やめる」を押したとき */
  onCancel: () => void;
  /** 渡すと左のボタンが「消す」になる。押したときに呼ぶ */
  onDelete?: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2">
        {onDelete ? (
          <Button type="button" variant="danger" onClick={onDelete}>
            {deleteLabel}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" form={formId} disabled={busy || !canSubmit}>
          {busy ? busyLabel : submitLabel}
        </Button>
      </div>
      {extra}
    </div>
  );
}
