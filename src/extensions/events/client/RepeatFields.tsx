import type { RepeatRule } from "@shared/api-types";
import { Chip } from "@/components/parts/Chip";
import { Field } from "@/components/parts/Field";
import { Segmented } from "@/components/parts/Segmented";
import { Input } from "@/components/ui/input";
import { dateKey, parseDateKey } from "@/lib/dates";
import { isoWeekdayInTokyo } from "../shared/tokyo";

const FREQ_OPTIONS = [
  { value: "none", label: "なし" },
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
  { value: "yearly", label: "毎年" },
] as const;

const END_OPTIONS = [
  { value: "none", label: "なし" },
  { value: "until", label: "日付" },
  { value: "count", label: "回数" },
] as const;

const WEEKDAY_CHIPS = [
  { iso: 1, label: "月" },
  { iso: 2, label: "火" },
  { iso: 3, label: "水" },
  { iso: 4, label: "木" },
  { iso: 5, label: "金" },
  { iso: 6, label: "土" },
  { iso: 7, label: "日" },
];

type Freq = (typeof FREQ_OPTIONS)[number]["value"];
type EndType = (typeof END_OPTIONS)[number]["value"];

/** 繰り返しの入力の下書き。画面だけで持ち、保存のときに API の形にする。0043 */
export type RepeatDraft = {
  freq: Freq;
  /** weekly だけで使う。月を 1、日を 7 とした数 */
  daysOfWeek: number[];
  end: EndType;
  /** `2026-09-21` の形 */
  until: string;
  /** 数字の文字列 */
  count: string;
};

/** 繰り返さない下書き。毎週を選んだときの既定の曜日だけ、始まりの日に合わせて持つ。0068 */
function defaultRepeatDraft(startDate: Date): RepeatDraft {
  return { freq: "none", daysOfWeek: [isoWeekdayInTokyo(startDate)], end: "none", until: "", count: "" };
}

/** 予定の repeat から、下書きを作る。無ければ繰り返さない下書き */
export function repeatDraftFromRule(rule: RepeatRule | null | undefined, startDate: Date): RepeatDraft {
  if (!rule) return defaultRepeatDraft(startDate);
  return {
    freq: rule.freq,
    daysOfWeek: rule.daysOfWeek?.length ? rule.daysOfWeek : [isoWeekdayInTokyo(startDate)],
    end: rule.until != null ? "until" : rule.count != null ? "count" : "none",
    until: rule.until != null ? dateKey(new Date(rule.until)) : "",
    count: rule.count != null ? String(rule.count) : "",
  };
}

/** API に送る形にする。繰り返さないなら null */
export function repeatDraftToInput(
  draft: RepeatDraft,
): { freq: Exclude<Freq, "none">; daysOfWeek?: number[]; until?: number; count?: number } | null {
  if (draft.freq === "none") return null;
  const until = draft.end === "until" ? (parseDateKey(draft.until)?.getTime() ?? undefined) : undefined;
  const count = draft.end === "count" && draft.count ? Number(draft.count) : undefined;
  return {
    freq: draft.freq,
    daysOfWeek: draft.freq === "weekly" ? draft.daysOfWeek : undefined,
    until,
    count,
  };
}

/**
 * 予定の繰り返しの選択。なし・毎日・毎週・毎月・毎年。F-36
 *
 * 毎週を選ぶと曜日の複数選択が、繰り返しを選ぶと終わりの選択(なし・日付・回数)が続けて出る。
 * 見るだけ・直せないときは、外側の fieldset の disabled が効く。
 */
export function RepeatFields({ value, onChange }: { value: RepeatDraft; onChange: (v: RepeatDraft) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-2" id="event-repeat-label">
        繰り返し
      </span>
      <Segmented
        label="繰り返し"
        full
        value={value.freq}
        onChange={(freq) => onChange({ ...value, freq })}
        options={FREQ_OPTIONS}
      />
      {value.freq === "weekly" && (
        // 7 つを均等に割る。390px でも折り返さない。#20
        <fieldset className="m-0 grid grid-cols-7 gap-1.5 border-0 p-0">
          <legend className="sr-only">繰り返す曜日</legend>
          {WEEKDAY_CHIPS.map((w) => (
            <Chip
              key={w.iso}
              className="min-w-0 justify-center px-0"
              aria-pressed={value.daysOfWeek.includes(w.iso)}
              onClick={() => {
                const has = value.daysOfWeek.includes(w.iso);
                const next = has ? value.daysOfWeek.filter((d) => d !== w.iso) : [...value.daysOfWeek, w.iso].sort();
                if (next.length > 0) onChange({ ...value, daysOfWeek: next });
              }}
            >
              {w.label}
            </Chip>
          ))}
        </fieldset>
      )}
      {value.freq !== "none" && (
        <div className="flex flex-col gap-1.5">
          {/* 予定自身の「終わり」(始まり・終わりの時刻)と同じシートに並ぶので、こちらは「繰り返しの終わり」と見せる。issue #19 */}
          <span className="text-xs font-medium text-ink-2" id="event-repeat-end-label">
            繰り返しの終わり
          </span>
          <Segmented
            label="繰り返しの終わり"
            full
            value={value.end}
            onChange={(end) => onChange({ ...value, end })}
            options={END_OPTIONS}
          />
          {value.end === "until" && (
            <Field label="終わりの日">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={value.until}
                  onChange={(e) => onChange({ ...value, until: e.target.value })}
                />
              )}
            </Field>
          )}
          {value.end === "count" && (
            <Field label="回数">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  value={value.count}
                  onChange={(e) => onChange({ ...value, count: e.target.value })}
                />
              )}
            </Field>
          )}
        </div>
      )}
    </div>
  );
}
