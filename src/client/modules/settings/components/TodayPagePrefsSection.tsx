/**
 * 設定の「機能」の、「今日のページでの見せ方」。並べ方(よく使う順・足した順・自分で並べる)、
 * 見出しに出す拡張、節ごとの開く・畳むを決める。ラボの「新しい見た目」を入れている人にだけ出す
 * (今日のページ自体が新しい見た目・スマホでしか出ないため)。0092、issue #240
 */
import { defaultExtension } from "@extensions/client/registry";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMe, useSetTodayPagePrefs } from "@/api/common";
import { Chip } from "@/components/parts/Chip";
import { Segmented } from "@/components/parts/Segmented";
import { useHeadlineCandidates, useTodaySections } from "@/lib/extensions";
import { useNewLookActive } from "@/lib/lab";
import { computeOpenSectionKeys, DEFAULT_TODAY_PAGE_PREFS, orderTodaySectionKeys } from "@/lib/today-sections";

const SORT_OPTIONS = [
  { value: "favorite", label: "よく使う順" },
  { value: "added", label: "足した順" },
  { value: "manual", label: "自分で並べる" },
] as const;

export function TodayPagePrefsSection() {
  const newLook = useNewLookActive();
  const me = useMe();
  const sections = useTodaySections();
  const headlineCandidates = useHeadlineCandidates();
  const setPrefs = useSetTodayPagePrefs();

  if (!newLook || !me.data) return null;

  const prefs = me.data.settings.todayPage ?? DEFAULT_TODAY_PAGE_PREFS;
  const manualOrder = me.data.settings.extensionOrder;
  const foldable = sections.filter((x) => x.manifest.key !== defaultExtension.manifest.key);
  const orderedKeys = orderTodaySectionKeys(
    foldable.map((x) => x.manifest.key),
    prefs.sortMode,
    manualOrder,
  );
  const openKeys = computeOpenSectionKeys(orderedKeys, prefs.openOverrides);
  const byKey = new Map(foldable.map((x) => [x.manifest.key, x]));

  return (
    <div className="glass flex flex-col gap-3 rounded-panel px-4.5 py-4">
      <h2 className="text-sm font-bold">今日のページでの見せ方</h2>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-ink-2">並べ方</span>
        <Segmented
          label="今日のページの並べ方"
          value={prefs.sortMode}
          options={SORT_OPTIONS}
          onChange={(sortMode) => setPrefs.mutate({ ...prefs, sortMode })}
        />
      </div>

      {headlineCandidates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-2">見出し</span>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              aria-pressed={prefs.headlineExtension === null}
              onClick={() => setPrefs.mutate({ ...prefs, headlineExtension: null })}
            >
              出さない
            </Chip>
            {headlineCandidates.map((ext) => (
              <Chip
                key={ext.manifest.key}
                aria-pressed={prefs.headlineExtension === ext.manifest.key}
                onClick={() => setPrefs.mutate({ ...prefs, headlineExtension: ext.manifest.key })}
              >
                {ext.manifest.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {orderedKeys.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-2">節の見せ方</span>
          <ul className="flex flex-col">
            {orderedKeys.map((key) => {
              const ext = byKey.get(key);
              if (!ext) return null;
              const open = openKeys.has(key);
              return (
                <li key={key} className="flex items-center justify-between gap-2 border-line py-1.5 not-first:border-t">
                  <span className="min-w-0 truncate text-sm font-medium">{ext.manifest.label}</span>
                  <button
                    type="button"
                    data-testid={`today-prefs-toggle-${key}`}
                    aria-label={`${ext.manifest.label}を今日のページで${open ? "畳む" : "開く"}`}
                    onClick={() =>
                      setPrefs.mutate({ ...prefs, openOverrides: { ...prefs.openOverrides, [key]: !open } })
                    }
                    className="grid size-11 flex-none place-items-center rounded-(--r-field) bg-field text-ink-2"
                  >
                    {open ? (
                      <ChevronUp className="size-4.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4.5" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
