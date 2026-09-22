import { settingsInput } from "@shared/schemas";
import { describe, expect, it } from "vitest";

describe("設定の入力。F-13、F-14、F-29、#50", () => {
  const base = { themeMode: "system", bgTheme: "glass", accentColor: "aizumi", userColor: "wakatake" } as const;

  it("明るさ、背景のテーマ、テーマカラー、自分の色がそろえば通す", () => {
    expect(settingsInput.safeParse(base).success).toBe(true);
    expect(settingsInput.safeParse({ ...base, bgTheme: "flat" }).success).toBe(true);
  });

  it("背景のテーマは glass か flat だけを受け付ける", () => {
    expect(settingsInput.safeParse({ ...base, bgTheme: "system" }).success).toBe(false);
    expect(settingsInput.safeParse({ ...base, bgTheme: "" }).success).toBe(false);
  });

  it("背景のテーマが無ければ断る", () => {
    const { bgTheme: _bgTheme, ...withoutBgTheme } = base;
    expect(settingsInput.safeParse(withoutBgTheme).success).toBe(false);
  });
});
