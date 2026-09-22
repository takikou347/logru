import {
  defaultHomeLayout,
  HOME_CALENDAR_WIDGET_KEY,
  type HomeWidgetCatalogEntry,
  isValidHomeLayout,
  mergeHomeLayout,
  visibleHomeLayout,
} from "@shared/home";
import { homeLayoutInput } from "@shared/schemas";
import { describe, expect, it } from "vitest";

const catalog: HomeWidgetCatalogEntry[] = [
  { key: HOME_CALENDAR_WIDGET_KEY, defaultSize: "large", defaultPlaced: true },
  { key: "home.day-panel", defaultSize: "medium", defaultPlaced: true },
  { key: "home.upcoming", defaultSize: "medium", defaultPlaced: true },
  { key: "memories.shortcut", defaultSize: "small", defaultPlaced: true },
  { key: "external-calendars.list", defaultSize: "small", defaultPlaced: false },
];

const alwaysVisible = () => true;

describe("既定の並び", () => {
  it("最初に置くものだけを、カタログの順で返す", () => {
    expect(defaultHomeLayout(catalog).map((w) => w.key)).toEqual([
      HOME_CALENDAR_WIDGET_KEY,
      "home.day-panel",
      "home.upcoming",
      "memories.shortcut",
    ]);
  });
});

describe("読むとき、いま出してよいものだけに絞る", () => {
  it("無効な拡張のウィジェットを除く", () => {
    const saved = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "memories.shortcut", size: "small" as const },
      { key: "home.upcoming", size: "medium" as const },
    ];
    const isVisible = (key: string) => key !== "memories.shortcut";
    expect(visibleHomeLayout(saved, catalog, isVisible).map((w) => w.key)).toEqual([
      HOME_CALENDAR_WIDGET_KEY,
      "home.upcoming",
    ]);
  });

  it("カタログに無い key(消えた拡張のものなど)は除く", () => {
    const saved = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "removed.widget", size: "small" as const },
    ];
    expect(visibleHomeLayout(saved, catalog, alwaysVisible).map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY]);
  });

  it("カレンダーの本体が並びに無くても、先頭に足す", () => {
    const saved = [{ key: "home.upcoming", size: "medium" as const }];
    expect(visibleHomeLayout(saved, catalog, alwaysVisible).map((w) => w.key)).toEqual([
      HOME_CALENDAR_WIDGET_KEY,
      "home.upcoming",
    ]);
  });

  it("同じ key が 2 つあれば、先に出てきたものだけ残す", () => {
    const saved = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "small" as const },
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
    ];
    const out = visibleHomeLayout(saved, catalog, alwaysVisible);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ key: HOME_CALENDAR_WIDGET_KEY, size: "small" });
  });
});

describe("編集を保存するとき、隠れているウィジェットを元の場所に戻す", () => {
  it("無効な拡張のウィジェットを、直前の見えるウィジェットの後ろに戻す", () => {
    const previous = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "memories.shortcut", size: "small" as const },
      { key: "home.upcoming", size: "medium" as const },
    ];
    // 「memories」を無効にしている間に、本体と「このあと」の順を入れ替えた
    const edited = [
      { key: "home.upcoming", size: "medium" as const },
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
    ];
    const isVisible = (key: string) => key !== "memories.shortcut";
    const merged = mergeHomeLayout(previous, edited, isVisible);
    expect(merged.map((w) => w.key)).toEqual(["home.upcoming", HOME_CALENDAR_WIDGET_KEY, "memories.shortcut"]);
  });

  it("編集で消えたウィジェットの後ろにあった隠れたウィジェットは、末尾に付ける", () => {
    const previous = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "home.day-panel", size: "medium" as const },
      { key: "memories.shortcut", size: "small" as const },
    ];
    // 「選んだ日の予定」を外した
    const edited = [{ key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const }];
    const isVisible = (key: string) => key !== "memories.shortcut";
    const merged = mergeHomeLayout(previous, edited, isVisible);
    expect(merged.map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY, "memories.shortcut"]);
  });

  it("足したウィジェットは、直した並びの中にそのまま残る", () => {
    const previous = [{ key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const }];
    const edited = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "memories.shortcut", size: "small" as const },
    ];
    const merged = mergeHomeLayout(previous, edited, alwaysVisible);
    expect(merged.map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY, "memories.shortcut"]);
  });

  it("編集を始めたときに見えていたものは、保存の時点で isVisible が false を返しても 2 重に入らない", () => {
    // 編集の途中で、別の端末が拡張を無効にした。isVisible はもう false を返す
    const previous = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "memories.shortcut", size: "small" as const },
    ];
    const edited = [
      { key: "memories.shortcut", size: "small" as const },
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
    ];
    const staleIsVisible = () => false; // 編集を始めたときは見えていたが、保存の時点ではもう false
    const merged = mergeHomeLayout(previous, edited, staleIsVisible);
    expect(merged.filter((w) => w.key === "memories.shortcut")).toHaveLength(1);
    expect(merged.map((w) => w.key)).toEqual(["memories.shortcut", HOME_CALENDAR_WIDGET_KEY]);
  });

  it("編集を始めたときに読み込み中で isVisible が false だったものは、並びから消えず戻る", () => {
    // グループの一覧が読み込み中で、editedEntries には入らなかった
    const previous = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "memories.shortcut", size: "small" as const },
      { key: "home.upcoming", size: "medium" as const },
    ];
    const edited = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "home.upcoming", size: "medium" as const },
    ];
    const loadingIsVisible = (key: string) => key !== "memories.shortcut";
    const merged = mergeHomeLayout(previous, edited, loadingIsVisible);
    expect(merged.map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY, "memories.shortcut", "home.upcoming"]);
  });
});

describe("大きさが、そのウィジェットで選べるか", () => {
  it("制限が無い key は、3 つとも選べる", () => {
    const widgets = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "home.upcoming", size: "small" as const },
    ];
    expect(isValidHomeLayout(widgets)).toBe(true);
  });

  it("memories.shortcut は large を選べない", () => {
    const widgets = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "memories.shortcut", size: "large" as const },
    ];
    expect(isValidHomeLayout(widgets)).toBe(false);
    expect(homeLayoutInput.safeParse({ form: "desktop", widgets }).success).toBe(false);
  });

  it("memories.shortcut の small、medium は選べる", () => {
    expect(
      isValidHomeLayout([
        { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
        { key: "memories.shortcut", size: "medium" as const },
      ]),
    ).toBe(true);
  });
});

describe("並びの入力の検証", () => {
  it("カレンダーの本体を含み、同じ key が無ければ通す", () => {
    const widgets = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: "home.upcoming", size: "medium" as const },
    ];
    expect(isValidHomeLayout(widgets)).toBe(true);
    expect(homeLayoutInput.safeParse({ form: "desktop", widgets }).success).toBe(true);
  });

  it("カレンダーの本体が無いと断る", () => {
    const widgets = [{ key: "home.upcoming", size: "medium" as const }];
    expect(isValidHomeLayout(widgets)).toBe(false);
    expect(homeLayoutInput.safeParse({ form: "desktop", widgets }).success).toBe(false);
  });

  it("同じ key が 2 つあると断る", () => {
    const widgets = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const },
      { key: HOME_CALENDAR_WIDGET_KEY, size: "small" as const },
    ];
    expect(isValidHomeLayout(widgets)).toBe(false);
  });

  it("desktop でも mobile でもない form と、知らない大きさは断る", () => {
    const widgets = [{ key: HOME_CALENDAR_WIDGET_KEY, size: "large" as const }];
    expect(homeLayoutInput.safeParse({ form: "tablet", widgets }).success).toBe(false);
    expect(
      homeLayoutInput.safeParse({ form: "desktop", widgets: [{ key: HOME_CALENDAR_WIDGET_KEY, size: "huge" }] })
        .success,
    ).toBe(false);
  });
});
