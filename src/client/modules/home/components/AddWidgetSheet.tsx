import type { HomeWidget } from "@extensions/client/types";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { useHomeWidgetVisibility } from "../layout";
import { HOME_WIDGET_CATALOG } from "../widgets";

/**
 * 「ウィジェットを足す」のシート。置いてあるものと、グループで無効な拡張のものは出さない。0028
 * @param present いま並びに置いてある key
 */
export function AddWidgetSheet({
  present,
  onAdd,
  onClose,
}: {
  present: Set<string>;
  onAdd: (widget: HomeWidget) => void;
  onClose: () => void;
}) {
  const isVisible = useHomeWidgetVisibility();
  const addable = HOME_WIDGET_CATALOG.filter((w) => !present.has(w.key) && isVisible(w.key));
  return (
    <ResponsiveSheet title="ウィジェットを足す" onClose={onClose}>
      {addable.length === 0 ? (
        <p className="text-sm text-ink-2">足せるウィジェットはありません。</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {addable.map((w) => (
            <li key={w.key}>
              <button
                type="button"
                onClick={() => {
                  onAdd(w);
                  onClose();
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-2xl border border-line px-4 py-3 text-left"
              >
                <b className="text-[15px]">{w.label}</b>
                <small className="text-xs text-ink-2">{w.description}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ResponsiveSheet>
  );
}
