import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "./ResponsiveSheet";

/** 画面の「+」で足せるもの 1 つぶん。issue #150 */
export type Addable = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
};

/**
 * どの画面でも同じ形の、主な「足す」ボタン。丸く、大きさは 56px、印は「+」だけ。0062
 *
 * 足せるものが 1 つなら、押すと直接それを開く。2 つ以上なら、小さなシートを開き、
 * アイコンと名前から選ぶ。足せるものが無ければ何も出さない(例は天気)。
 * @param label 読み上げの名前。画面ごとに「予定を足す」「支出を記録する」のように付ける
 * @param addables 足せるものの一覧
 * @param sheetTitle 2 つ以上のときに開く、選ぶシートの見出し。無ければ label を使う
 * @param disabled いま押せないとき。足せるものが 1 つの画面だけで使う(例はまだ来ていない日の記録)
 * @param disabledLabel 押せないときの読み上げの名前。渡さなければ label のまま
 */
export function PrimaryAddButton({
  label,
  addables,
  sheetTitle,
  disabled,
  disabledLabel,
}: {
  label: string;
  addables: Addable[];
  sheetTitle?: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (addables.length === 0) return null;
  if (addables.length === 1) {
    const only = addables[0]!;
    return (
      <Button
        type="button"
        aria-label={disabled ? (disabledLabel ?? label) : label}
        onClick={only.onClick}
        disabled={disabled}
        className="size-14 rounded-full p-0"
      >
        <Plus className="size-6" aria-hidden="true" />
      </Button>
    );
  }
  return (
    <>
      <Button type="button" aria-label={label} onClick={() => setOpen(true)} className="size-14 rounded-full p-0">
        <Plus className="size-6" aria-hidden="true" />
      </Button>
      {open && (
        <ResponsiveSheet title={sheetTitle ?? label} onClose={() => setOpen(false)}>
          <div className="grid gap-2">
            {addables.map((a) => (
              <button
                key={a.key}
                type="button"
                className="flex min-h-14 items-center gap-3 rounded-[18px] border border-(--glass-edge) bg-field px-4.5 text-base font-bold"
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
              >
                <a.icon className="size-5" aria-hidden="true" />
                {a.label}
              </button>
            ))}
          </div>
        </ResponsiveSheet>
      )}
    </>
  );
}
