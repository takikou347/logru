import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * 新しい予定の書きかけがある間に、その日の一覧から別の予定を開こうとしたときの確認。issue #200
 * 開くと、いま入れている題名などの下書きが消えるため、先に確かめる。
 * @param onDiscard 書きかけを捨てて開くことを選んだとき
 * @param onClose やめて、いまの下書きに留まるとき
 */
export function DiscardDraftDialog({ onDiscard, onClose }: { onDiscard: () => void; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton
        className="glass gap-4 rounded-panel border-(--glass-edge) bg-(--glass-flat) p-6 text-ink sm:max-w-[360px]"
      >
        <DialogHeader>
          {/* 見出しが長くなっても、右上の閉じるボタンに重ならないよう余白を空ける */}
          <DialogTitle className="pr-9 text-[17px] font-bold">書きかけを捨てて開きますか</DialogTitle>
          <DialogDescription className="text-ink-2">まだ保存していない内容が消えます。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            やめる
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            開く
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
