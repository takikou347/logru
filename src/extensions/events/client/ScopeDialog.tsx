import type { ItemEditScope } from "@extensions/client/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SCOPE_OPTIONS: { value: ItemEditScope; label: string }[] = [
  { value: "this", label: "この回だけ" },
  { value: "following", label: "これ以降" },
  { value: "all", label: "全部" },
];

/**
 * 繰り返す予定を直す、消すときに挟む確認。この回だけ・これ以降・全部を選ぶ。0043
 * @param action 「直す」か「消す」。見出しと説明に出す
 * @param onChoose 範囲を選んだとき
 * @param onClose 選ばずに閉じたとき
 */
export function ScopeDialog({
  action,
  onChoose,
  onClose,
}: {
  action: "edit" | "delete";
  onChoose: (scope: ItemEditScope) => void;
  onClose: () => void;
}) {
  const title = action === "edit" ? "どの回を直しますか" : "どの回を消しますか";
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        className="glass gap-4 rounded-panel border-(--glass-edge) bg-(--glass-flat) p-6 text-ink sm:max-w-[360px]"
      >
        <DialogHeader>
          {/* 見出しが長くなっても、右上の閉じるボタンに重ならないよう余白を空ける */}
          <DialogTitle className="pr-9 text-[17px] font-bold">{title}</DialogTitle>
          <DialogDescription className="text-ink-2">繰り返す予定です。効かせる範囲を選んでください。</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {SCOPE_OPTIONS.map((o) => (
            <Button
              key={o.value}
              type="button"
              variant={o.value === "this" ? "default" : "secondary"}
              className="w-full justify-center"
              onClick={() => onChoose(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
