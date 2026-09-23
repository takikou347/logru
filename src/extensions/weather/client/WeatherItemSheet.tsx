import type { ItemEditorProps } from "@extensions/client/types";
import { FieldMessage, PanelRow } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/dates";

/**
 * 天気の中身を見るシート。読むだけで、直すボタンも消すボタンも出さない。F-404
 * 出どころの表示を出す。Open-Meteo の CC BY 4.0 に従う。F-405
 */
export function WeatherItemSheet({ target, onClose }: ItemEditorProps) {
  if (target.mode !== "edit") return null;
  const item = target.item;
  return (
    <ResponsiveSheet title={item.title} description="いつもの場所の天気です。" onClose={onClose}>
      <div>
        <PanelRow>
          <span className="text-ink-2">日付</span>
          <span className="text-right">{formatDay(new Date(item.startsAt))}</span>
        </PanelRow>
        {item.place && (
          <PanelRow>
            <span className="text-ink-2">場所</span>
            <span className="min-w-0 text-right break-words">{item.place}</span>
          </PanelRow>
        )}
      </div>
      <FieldMessage>気象データ: Open-Meteo.com</FieldMessage>
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
