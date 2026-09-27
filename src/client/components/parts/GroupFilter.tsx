/**
 * グループの絞り込み。すべて、自分だけ、共有のグループ。カレンダー、思い出、家計簿、共有リストで共通の部品。0057
 *
 * スマホは横に流れる帯、PC は左の列。見た目と余白はカレンダーに合わせる。バーは、はみ出すときだけ出す。
 * 帯には children で、人のチップや種類の入り切りのように、絞り込みの後ろに足せるものを渡せる。
 */
import type { GroupSummary, Me } from "@shared/api-types";
import type { ReactNode } from "react";
import { SideHeading, sideItemClass } from "@/components/layout/AppLayout";
import { Chip } from "@/components/parts/Chip";
import { Dot } from "@/components/parts/Panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { groupColor } from "@/lib/colors";

/** グループの絞り込みの選択肢。すべて、自分だけ、共有のグループの 1 つずつ */
export type GroupFilterOption = { key: string; pressed: boolean; onClick: () => void; label: ReactNode };

/**
 * グループの絞り込みの選択肢を組み立てる。すべて、自分だけ(自分だけのグループ)、共有のグループの順。0009、0057
 * @param me 自分だけのグループの色を出すのに使う。読み込み中は省いてよい
 * @param personalLabel 自分だけのグループの文言。既定は「自分だけ」
 */
export function groupFilterOptions({
  groups,
  me,
  value,
  onChange,
  allLabel = "すべて",
  personalLabel = "自分だけ",
}: {
  groups: GroupSummary[];
  me: Me | null | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  allLabel?: string;
  personalLabel?: string;
}): GroupFilterOption[] {
  return [
    { key: "all", pressed: value === null, onClick: () => onChange(null), label: allLabel },
    ...groups.map((g) => ({
      key: g.id,
      pressed: value === g.id,
      onClick: () => onChange(value === g.id ? null : g.id),
      label: (
        <>
          <Dot color={me ? groupColor(g, me.colorPrefs) : g.color} />
          {g.isPersonal ? personalLabel : g.name}
        </>
      ),
    })),
  ];
}

/**
 * スマホの、横に流れる絞り込みの帯。はみ出すときだけ下にバーを出す。F-25
 * @param tourId 案内(ScreenTour)が指す data-tour。省くと付けない
 * @param children グループの後ろに足すもの。人のチップ、種類の入り切りなど
 */
export function GroupFilterBand({
  options,
  tourId,
  children,
}: {
  options: GroupFilterOption[];
  tourId?: string;
  children?: ReactNode;
}) {
  return (
    <nav className="-mx-4 lg:hidden" aria-label="グループで絞る" data-tour={tourId}>
      <ScrollArea
        orientation="horizontal"
        className="px-4"
        viewportClassName="pb-3"
        scrollbarClassName="left-4! right-4!"
      >
        <div className="flex w-max gap-2">
          {options.map((o) => (
            <Chip key={o.key} aria-pressed={o.pressed} onClick={o.onClick}>
              {o.label}
            </Chip>
          ))}
          {children}
        </div>
      </ScrollArea>
    </nav>
  );
}

/**
 * PC の左の列に置く、グループの絞り込み。カレンダーの左の列と同じ形。
 * @param tourId 案内(ScreenTour)が指す data-tour。省くと付けない
 * @param renderOption 行の見た目を差し替える。カレンダーは、共有のグループをメンバーごとに開け閉めできる行にする。F-20
 *   一覧の中で呼ぶので、返す要素に `key={option.key}` を付けること
 */
export function SideGroupFilter({
  options,
  tourId,
  renderOption,
}: {
  options: GroupFilterOption[];
  tourId?: string;
  renderOption?: (option: GroupFilterOption) => ReactNode;
}) {
  return (
    <div role="group" aria-label="表示するグループ" className="pr-2" data-tour={tourId}>
      <SideHeading>表示するグループ</SideHeading>
      {options.map((o) =>
        renderOption ? (
          renderOption(o)
        ) : (
          <button key={o.key} type="button" className={sideItemClass} aria-pressed={o.pressed} onClick={o.onClick}>
            {o.label}
          </button>
        ),
      )}
    </div>
  );
}
