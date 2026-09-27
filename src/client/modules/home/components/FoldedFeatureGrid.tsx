/**
 * 今日のページの「畳んだ機能」。機能が 7 個以上のとき、よく使う上位以外をここに札で並べる。0092、issue #240
 * 札は機能の名前と、7 文字ほどの要約(useTodaySummaries)。押すとその場で節が開く。
 */
import type { ClientExtension } from "@extensions/client/types";

export function FoldedFeatureGrid({
  sections,
  summaries,
  onOpen,
}: {
  sections: ClientExtension[];
  summaries: Record<string, string>;
  onOpen: (key: string) => void;
}) {
  if (sections.length === 0) return null;
  return (
    <div className="glass rounded-panel px-3 py-3">
      <h2 className="mb-2 px-0.5 text-xs font-bold text-ink-2">畳んだ機能</h2>
      <div data-testid="today-folded-grid" className="grid grid-cols-3 gap-2">
        {sections.map((ext) => (
          <button
            key={ext.manifest.key}
            type="button"
            data-testid={`today-folded-${ext.manifest.key}`}
            onClick={() => onOpen(ext.manifest.key)}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-(--r-field) bg-field px-1 py-2 text-center"
          >
            <span className="w-full truncate text-[11px] font-bold text-ink">{ext.manifest.label}</span>
            <span className="w-full truncate text-[11px] text-ink-2">{summaries[ext.manifest.key] ?? ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
