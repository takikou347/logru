import { GROUP_COLORS } from "../../shared/colors";
import { Swatches } from "./controls";
import { Sheet } from "./Sheet";

/** 自分の画面の中だけで色を変えるシート。F-15、F-18 */
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
    <Sheet title={title} onClose={onClose}>
      <p className="hint">自分の画面の中だけで変わります。ほかの人の画面は変わりません。</p>
      <Swatches label={title} value={value} options={GROUP_COLORS} onChange={onPick} />
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onReset} disabled={!isCustom}>
          元の色に戻す
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          閉じる
        </button>
      </div>
    </Sheet>
  );
}
