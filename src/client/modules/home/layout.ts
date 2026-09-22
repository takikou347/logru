/**
 * 保存した並びと、いま使える拡張から、ホームに出すウィジェットを組み立てる。0029
 * 並びそのものの計算は src/shared/home.ts の純粋な関数を使う。ここは画面の hook との橋渡しだけ
 */
import type { HomeWidget } from "@extensions/client/types";
import type { HomeForm, HomeWidgetEntry, HomeWidgetSize } from "@shared/api-types";
import { defaultHomeLayout, mergeHomeLayout, visibleHomeLayout } from "@shared/home";
import { useCallback, useMemo } from "react";
import { useEnabledExtensions } from "@/lib/extensions";
import { useHomeLayout } from "./api";
import { HOME_WIDGET_CATALOG, homeWidget, homeWidgetOwner } from "./widgets";

/** その key のウィジェットが、いま出してよいか。土台はいつも true、拡張のものは有効なときだけ */
export function useHomeWidgetVisibility(): (key: string) => boolean {
  const enabled = useEnabledExtensions();
  const enabledKeys = useMemo(() => new Set(enabled.map((x) => x.manifest.key)), [enabled]);
  return useCallback(
    (key: string) => {
      const owner = homeWidgetOwner(key);
      if (owner === undefined) return false;
      if (owner === null) return true;
      return enabledKeys.has(owner);
    },
    [enabledKeys],
  );
}

export type HomeWidgetSlot = { entry: HomeWidgetEntry; widget: HomeWidget };

/**
 * いま画面に出すウィジェットを返す。保存が無ければ既定の並び。無効な拡張のものは除く。
 * rawSaved は、保存されている(隠れているものも含む)生の並び。編集後の保存の組み立てに使う。
 *
 * 並びを読めなかったとき(error)は、既定の並びで static に埋めない。読めた上で保存が無いとき(widgets が null)
 * だけ既定の並びを使う。読めない間は編集を始められないようにするため、呼び出し側は error を見る
 */
export function useVisibleHomeWidgets(form: HomeForm): {
  loading: boolean;
  error: Error | null;
  rawSaved: HomeWidgetEntry[];
  slots: HomeWidgetSlot[];
  refetch: () => void;
} {
  const layout = useHomeLayout(form);
  const isVisible = useHomeWidgetVisibility();
  const rawSaved = useMemo(
    () => (layout.data ? (layout.data.widgets ?? defaultHomeLayout(HOME_WIDGET_CATALOG)) : []),
    [layout.data],
  );
  const slots = useMemo(() => {
    const visible = visibleHomeLayout(rawSaved, HOME_WIDGET_CATALOG, isVisible);
    return visible.flatMap((entry) => {
      const widget = homeWidget(entry.key);
      return widget ? [{ entry, widget }] : [];
    });
  }, [rawSaved, isVisible]);
  return {
    loading: layout.isPending,
    error: layout.error,
    rawSaved,
    slots,
    refetch: () => void layout.refetch(),
  };
}

/**
 * 編集で直した「見えている並び」を、隠れているウィジェットを元の場所に戻しつつ保存の形にする。
 * isVisible は、編集を始めたときに 1 度だけ決めたものを渡す(呼び出し元が編集の間ずっと同じものを使う)。
 * 大きさがそのウィジェットで選べないもの(sizes に無いもの)は、既定の大きさに戻す
 */
export function useMergeHomeLayout(): (
  previous: HomeWidgetEntry[],
  edited: HomeWidgetEntry[],
  isVisible: (key: string) => boolean,
) => HomeWidgetEntry[] {
  return useCallback((previous, edited, isVisible) => {
    const merged = mergeHomeLayout(previous, edited, isVisible);
    return merged.map((entry) => {
      const widget = homeWidget(entry.key);
      if (!widget || (widget.sizes as readonly HomeWidgetSize[]).includes(entry.size)) return entry;
      return { ...entry, size: widget.defaultSize };
    });
  }, []);
}
