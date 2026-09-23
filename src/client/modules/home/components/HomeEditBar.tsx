import { Check, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 「ホームを編集」の間、上の帯の代わりに出す帯。0029、#76
 * 取り消しと保存はここだけに置く。帯は画面の上に留め、並べ替えの途中でもすぐ保存できるようにする。
 * その下に、足す、最初の並びに戻す、を置く。
 */
export function HomeEditBar({
  saving,
  onCancel,
  onSave,
  onAdd,
  onReset,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onAdd: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <header
        data-testid="home-edit-bar"
        className="glass sticky top-[max(8px,env(safe-area-inset-top))] z-10 flex min-h-[58px] items-center gap-1.5 rounded-panel py-1.5 pr-1.5 pl-4 lg:top-4 lg:pl-5"
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate text-[17px] font-bold">ホームを編集</h1>
          <p className="truncate text-xs text-ink-2">並べ替えて保存</p>
        </div>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          取り消し
        </Button>
        <Button size="sm" className="px-4" aria-busy={saving} disabled={saving} onClick={onSave}>
          <Check className="size-4" />
          保存する
        </Button>
      </header>
      <div className="-mb-1 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 lg:flex-none" onClick={onAdd}>
          <Plus className="size-4" />
          ウィジェットを足す
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 lg:flex-none" onClick={onReset}>
          <RotateCcw className="size-4" />
          最初の並びに戻す
        </Button>
      </div>
    </>
  );
}
