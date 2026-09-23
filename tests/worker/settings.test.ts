import { extensionOrderInput, settingsInput } from "@shared/schemas";
import { describe, expect, it } from "vitest";

describe("設定の入力。F-13、F-14、F-30、#50", () => {
  const base = { themeMode: "system", bgTheme: "glass", accentColor: "aizumi", userColor: "wakatake" } as const;

  it("明るさ、背景のテーマ、テーマカラー、自分の色がそろえば通す", () => {
    expect(settingsInput.safeParse(base).success).toBe(true);
    expect(settingsInput.safeParse({ ...base, bgTheme: "flat" }).success).toBe(true);
  });

  it("背景のテーマは glass か flat だけを受け付ける", () => {
    expect(settingsInput.safeParse({ ...base, bgTheme: "system" }).success).toBe(false);
    expect(settingsInput.safeParse({ ...base, bgTheme: "" }).success).toBe(false);
  });

  it("背景のテーマは任意。無くても通す。PWA の古い画面は Service Worker が新しくなるまでこの項目を送らない", () => {
    const { bgTheme: _bgTheme, ...withoutBgTheme } = base;
    const result = settingsInput.safeParse(withoutBgTheme);
    expect(result.success).toBe(true);
    // drizzle の .set() は項目が無ければ更新しない。ここで項目自体が無いこと(undefined で埋めていないこと)を確かめる。
    // 埋めてしまうと `{ ...values }` を通した set に bgTheme: undefined が入り、保存してある値を消しかねない
    expect(result.success && "bgTheme" in result.data).toBe(false);
  });
});

describe("足した機能のタイルの並びの入力。0058", () => {
  it("key の配列を通す", () => {
    expect(extensionOrderInput.safeParse({ order: ["kakeibo", "memories"] }).success).toBe(true);
  });

  it("空の配列も通す。全部外すと並びが空になる", () => {
    expect(extensionOrderInput.safeParse({ order: [] }).success).toBe(true);
  });

  it("60 件を超える、または空文字を含むと通さない", () => {
    expect(extensionOrderInput.safeParse({ order: Array(61).fill("x") }).success).toBe(false);
    expect(extensionOrderInput.safeParse({ order: [""] }).success).toBe(false);
  });
});
