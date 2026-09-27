/**
 * 送るシートの下に留める行。「やめる」か「消す」、右に「保存する」。`ResponsiveSheet` の `footer` に渡す。0081、issue #207
 *
 * `onDelete` を渡すと左は「消す」(danger)になる。渡さなければ「やめる」(ghost)。
 * `extra` を渡すと、この行の下にもう 1 段(「続けて記録」など)を積む。
 *
 * 新しい見た目・スマホで OS のキーボードが出ている間は、この行の代わりに「前の欄・次の欄・保存」だけの
 * 小さな帯にする(アイコンだけ。読み上げの名前は保つ)。`extra` と「やめる・消す」はこの帯には出ない。
 * `keepOpen` のようなもう 1 段の操作は、キーボードを閉じてから使う。0094、issue #242
 */
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { focusAdjacentField } from "@/lib/keyboard-field-nav";
import { useKeyboardViewport } from "@/lib/keyboard-viewport";
import { useNewLookActive } from "@/lib/lab";
import { useMediaQuery } from "@/lib/use-media-query";

/** formId の form の中で、フォーカスを 1 つ前・1 つ次の欄へ移す */
function moveField(formId: string, dir: 1 | -1) {
  const form = document.getElementById(formId);
  if (form instanceof HTMLFormElement) focusAdjacentField(form, dir);
}

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
  const newLook = useNewLookActive();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const keyboard = useKeyboardViewport(newLook && !desktop);

  if (keyboard.open) {
    // 前の欄・次の欄は、いま文字を打っている欄からフォーカスを奪わない。ボタンは押しても
    // フォーカスしない(mousedown で防ぐ)。奪うと、押した瞬間の activeElement がこのボタン自身に
    // なり、どの欄から動かすかが分からなくなる
    const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="前の欄へ"
          onMouseDown={keepFocus}
          onClick={() => moveField(formId, -1)}
        >
          <ChevronUpIcon className="size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="次の欄へ"
          onMouseDown={keepFocus}
          onClick={() => moveField(formId, 1)}
        >
          <ChevronDownIcon className="size-5" />
        </Button>
        <Button
          type="submit"
          form={formId}
          size="icon"
          disabled={busy || !canSubmit}
          aria-label={busy ? busyLabel : submitLabel}
        >
          <CheckIcon className="size-5" />
        </Button>
      </div>
    );
  }

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
