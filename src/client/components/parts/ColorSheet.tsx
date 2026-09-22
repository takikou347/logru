import { GROUP_COLORS } from "@shared/colors";
import { Button } from "@/components/ui/button";
import { ColorSwatches } from "./ColorSwatches";
import { ResponsiveSheet } from "./ResponsiveSheet";

/**
 * 自分の画面の中だけで色を変えるシート。F-15、F-18
 *
 * @param value いま見えている色
 * @param isCustom 自分で色を選んでいるか。false なら「元の色に戻す」を押せない
 * @param onPick 色を選んだとき。すぐ画面に効かせる
 * @param onReset 元の色に戻すとき
 */
export function ColorSheet({
  title,
  value,
  isCustom,
  onPick,
  onReset,
  onClose,
}: {
  title: string;
  value: string;
  isCustom: boolean;
  onPick: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <ResponsiveSheet
      title={title}
      description="自分の画面の中だけで変わります。ほかの人の画面は変わりません。"
      onClose={onClose}
    >
      <ColorSwatches label={title} value={value} options={GROUP_COLORS} onChange={onPick} />
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onReset} disabled={!isCustom}>
          元の色に戻す
        </Button>
        <Button onClick={onClose}>閉じる</Button>
      </div>
    </ResponsiveSheet>
  );
}
