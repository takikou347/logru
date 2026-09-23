import type { HomeWidgetEntry } from "@shared/api-types";
import {
  defaultHomeLayout,
  HOME_CALENDAR_WIDGET_KEY,
  type HomeWidgetCatalogEntry,
  isValidHomeLayout,
  mergeHomeLayout,
  toHomeWidgetEntry,
  visibleHomeLayout,
} from "@shared/home";
import { homeLayoutInput } from "@shared/schemas";
import { describe, expect, it } from "vitest";

const catalog: HomeWidgetCatalogEntry[] = [
  { key: HOME_CALENDAR_WIDGET_KEY, defaultPlaced: true },
  { key: "home.day-panel", defaultPlaced: true },
  { key: "home.upcoming", defaultPlaced: true },
  { key: "memories.koma", defaultPlaced: true },
  { key: "external-calendars.list", defaultPlaced: false },
];

const alwaysVisible = () => true;

describe("既定の並び", () => {
  it("最初に置くものだけを、カタログの順で返す", () => {
    expect(defaultHomeLayout(catalog).map((w) => w.key)).toEqual([
      HOME_CALENDAR_WIDGET_KEY,
      "home.day-panel",
      "home.upcoming",
      "memories.koma",
    ]);
  });
});

describe("読むとき、いま出してよいものだけに絞る", () => {
  it("無効な拡張のウィジェットを除く", () => {
    const saved = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "memories.koma" }, { key: "home.upcoming" }];
    const isVisible = (key: string) => key !== "memories.koma";
    expect(visibleHomeLayout(saved, catalog, isVisible).map((w) => w.key)).toEqual([
      HOME_CALENDAR_WIDGET_KEY,
      "home.upcoming",
    ]);
  });

  it("カタログに無い key(消えた拡張のものなど)は除く", () => {
    const saved = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "removed.widget" }];
    expect(visibleHomeLayout(saved, catalog, alwaysVisible).map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY]);
  });

  it("カレンダーの本体が並びに無くても、先頭に足す", () => {
    const saved = [{ key: "home.upcoming" }];
    expect(visibleHomeLayout(saved, catalog, alwaysVisible).map((w) => w.key)).toEqual([
      HOME_CALENDAR_WIDGET_KEY,
      "home.upcoming",
    ]);
  });

  it("同じ key が 2 つあれば、先に出てきたものだけ残す", () => {
    const saved = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: HOME_CALENDAR_WIDGET_KEY }];
    const out = visibleHomeLayout(saved, catalog, alwaysVisible);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ key: HOME_CALENDAR_WIDGET_KEY });
  });
});

describe("編集を保存するとき、隠れているウィジェットを元の場所に戻す", () => {
  it("無効な拡張のウィジェットを、直前の見えるウィジェットの後ろに戻す", () => {
    const previous = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "memories.koma" }, { key: "home.upcoming" }];
    // 「memories」を無効にしている間に、本体と「このあと」の順を入れ替えた
    const edited = [{ key: "home.upcoming" }, { key: HOME_CALENDAR_WIDGET_KEY }];
    const isVisible = (key: string) => key !== "memories.koma";
    const merged = mergeHomeLayout(previous, edited, isVisible);
    expect(merged.map((w) => w.key)).toEqual(["home.upcoming", HOME_CALENDAR_WIDGET_KEY, "memories.koma"]);
  });

  it("編集で消えたウィジェットの後ろにあった隠れたウィジェットは、末尾に付ける", () => {
    const previous = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "home.day-panel" }, { key: "memories.koma" }];
    // 「選んだ日の予定」を外した
    const edited = [{ key: HOME_CALENDAR_WIDGET_KEY }];
    const isVisible = (key: string) => key !== "memories.koma";
    const merged = mergeHomeLayout(previous, edited, isVisible);
    expect(merged.map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY, "memories.koma"]);
  });

  it("足したウィジェットは、直した並びの中にそのまま残る", () => {
    const previous = [{ key: HOME_CALENDAR_WIDGET_KEY }];
    const edited = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "memories.koma" }];
    const merged = mergeHomeLayout(previous, edited, alwaysVisible);
    expect(merged.map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY, "memories.koma"]);
  });

  it("編集を始めたときに見えていたものは、保存の時点で isVisible が false を返しても 2 重に入らない", () => {
    // 編集の途中で、別の端末が拡張を無効にした。isVisible はもう false を返す
    const previous = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "memories.koma" }];
    const edited = [{ key: "memories.koma" }, { key: HOME_CALENDAR_WIDGET_KEY }];
    const staleIsVisible = () => false; // 編集を始めたときは見えていたが、保存の時点ではもう false
    const merged = mergeHomeLayout(previous, edited, staleIsVisible);
    expect(merged.filter((w) => w.key === "memories.koma")).toHaveLength(1);
    expect(merged.map((w) => w.key)).toEqual(["memories.koma", HOME_CALENDAR_WIDGET_KEY]);
  });

  it("編集を始めたときに読み込み中で isVisible が false だったものは、並びから消えず戻る", () => {
    // グループの一覧が読み込み中で、editedEntries には入らなかった
    const previous = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "memories.koma" }, { key: "home.upcoming" }];
    const edited = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "home.upcoming" }];
    const loadingIsVisible = (key: string) => key !== "memories.koma";
    const merged = mergeHomeLayout(previous, edited, loadingIsVisible);
    expect(merged.map((w) => w.key)).toEqual([HOME_CALENDAR_WIDGET_KEY, "memories.koma", "home.upcoming"]);
  });
});

describe("前に保存した大きさは読まない。0037", () => {
  it("保存した並びに size があっても、出す並びは key だけを持つ", () => {
    const saved = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" },
      { key: "home.upcoming", size: "small" },
    ] as unknown as HomeWidgetEntry[];
    expect(visibleHomeLayout(saved, catalog, alwaysVisible)).toEqual([
      { key: HOME_CALENDAR_WIDGET_KEY },
      { key: "home.upcoming" },
    ]);
  });

  it("保存する並びも key だけを持つ。隠れていたものの size も落とす", () => {
    const previous = [
      { key: HOME_CALENDAR_WIDGET_KEY, size: "large" },
      { key: "memories.koma", size: "small" },
    ] as unknown as HomeWidgetEntry[];
    const edited = [{ key: HOME_CALENDAR_WIDGET_KEY }];
    const merged = mergeHomeLayout(previous, edited, (key) => key !== "memories.koma");
    expect(merged).toEqual([{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "memories.koma" }]);
  });

  it("toHomeWidgetEntry は key のほかを捨てる", () => {
    expect(toHomeWidgetEntry({ key: "home.upcoming", size: "medium" } as unknown as HomeWidgetEntry)).toEqual({
      key: "home.upcoming",
    });
  });
});

describe("並びの入力の検証", () => {
  it("カレンダーの本体を含み、同じ key が無ければ通す", () => {
    const widgets = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: "home.upcoming" }];
    expect(isValidHomeLayout(widgets)).toBe(true);
    expect(homeLayoutInput.safeParse({ form: "desktop", widgets }).success).toBe(true);
  });

  it("カレンダーの本体が無いと断る", () => {
    const widgets = [{ key: "home.upcoming" }];
    expect(isValidHomeLayout(widgets)).toBe(false);
    expect(homeLayoutInput.safeParse({ form: "desktop", widgets }).success).toBe(false);
  });

  it("同じ key が 2 つあると断る", () => {
    const widgets = [{ key: HOME_CALENDAR_WIDGET_KEY }, { key: HOME_CALENDAR_WIDGET_KEY }];
    expect(isValidHomeLayout(widgets)).toBe(false);
  });

  it("desktop でも mobile でもない form は断る", () => {
    const widgets = [{ key: HOME_CALENDAR_WIDGET_KEY }];
    expect(homeLayoutInput.safeParse({ form: "tablet", widgets }).success).toBe(false);
  });

  it("前の画面が size を付けて送っても通し、size を捨てる", () => {
    const parsed = homeLayoutInput.safeParse({
      form: "mobile",
      widgets: [{ key: HOME_CALENDAR_WIDGET_KEY, size: "large" }],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.widgets).toEqual([{ key: HOME_CALENDAR_WIDGET_KEY }]);
  });
});
