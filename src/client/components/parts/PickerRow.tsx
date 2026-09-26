/**
 * 「押すと下から一覧が開く行」の共通の部品。0067、#194
 *
 * 設定の行(RowButton)の形をした行を押すと、`ResponsiveSheet` で一覧が開く。一覧は縦に並べ、
 * 選んでいる行だけに印(Check)を付ける。共有(`SharePickerRow`)と同じ考え方だが、role は
 * `listbox`・`option` にする。`role="radio"` を `<button>` に直に付けると Biome の
 * `lint/a11y/useSemanticElements` が `<input type="radio">` への置き換えを求めてくるため。
 *
 * 口座・払った人など、1 つを選ぶ場面で使う。中身(一覧の行)は呼び出し側が `PickerOptionRow` で組む。
 */

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { FieldMessage, RowButton } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { cn } from "@/lib/utils";

/**
 * 押すと一覧が開く行。ラベルと、いまの選択(`valueNode`)を出す。
 * @param label 行の名前。「口座」「払った人」など
 * @param valueNode いまの選択の表示。選んでいなければ省く
 * @param sheetTitle 開く一覧の見出し。省くと label と同じ
 * @param open いま一覧が開いているか。呼び出し側が持つ
 * @param onOpen 行を押したとき
 * @param onClose 一覧を閉じるとき
 * @param children 一覧の中身(`PickerOptionRow` の並びや `EmptyState` など)
 */
export function PickerRow({
  label,
  valueNode,
  sheetTitle,
  disabled,
  disabledReason,
  open,
  onOpen,
  onClose,
  children,
}: {
  label: string;
  valueNode?: ReactNode;
  sheetTitle?: string;
  disabled?: boolean;
  disabledReason?: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <RowButton
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={onOpen}
        className={cn(disabled && "opacity-50")}
      >
        <span>{label}</span>
        {valueNode && (
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-ink-2">{valueNode}</span>
        )}
      </RowButton>
      {disabled && disabledReason && <FieldMessage>{disabledReason}</FieldMessage>}
      {open && (
        <ResponsiveSheet title={sheetTitle ?? label} onClose={onClose}>
          <div role="listbox" aria-label={sheetTitle ?? label} className="flex flex-col">
            {children}
          </div>
        </ResponsiveSheet>
      )}
    </div>
  );
}

/** 一覧の 1 行。44px 以上、選んでいれば右に Check を付ける。`PickerRow` の中で使う */
export function PickerOptionRow({
  checked,
  onSelect,
  disabled,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      disabled={disabled}
      onClick={onSelect}
      className="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0 disabled:opacity-45"
    >
      {children}
      {checked && <Check className="ml-auto size-4 flex-none text-primary" aria-hidden="true" />}
    </button>
  );
}
