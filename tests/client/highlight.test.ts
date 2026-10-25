import { describe, expect, it } from "vitest";
import { splitByMatch } from "../../src/client/lib/highlight";

const m = (text: string) => ({ text, match: true });
const n = (text: string) => ({ text, match: false });

describe("splitByMatch。探した文字を目立たせる", () => {
  it("一致した所を分ける", () => {
    expect(splitByMatch("歯医者の予約", "予約")).toEqual([n("歯医者の"), m("予約")]);
  });
  it("大文字と小文字を区別しない", () => {
    expect(splitByMatch("Team MEETING", "meeting")).toEqual([n("Team "), m("MEETING")]);
  });
  it("全角と半角を区別しない", () => {
    expect(splitByMatch("ＡＢＣ 123", "abc")).toEqual([m("ＡＢＣ"), n(" 123")]);
    expect(splitByMatch("会議 1", "１")).toEqual([n("会議 "), m("1")]);
  });
  it("NFKC で長さが変わる文字でも、元の位置で囲む", () => {
    // ㈱ は NFKC で (株) の 3 文字になる
    expect(splitByMatch("㈱ロゴ", "ロゴ")).toEqual([n("㈱"), m("ロゴ")]);
    expect(splitByMatch("a㈱b", "株")).toEqual([n("a"), m("㈱"), n("b")]);
    // 半角カナの濁点は 1 文字にそろう
    expect(splitByMatch("ﾊﾟｰﾃｨｰ", "パ")).toEqual([m("ﾊﾟ"), n("ｰﾃｨｰ")]);
    // 濁点の前までで探しても、その文字ごと囲む。#305
    expect(splitByMatch("ﾊﾟｰﾃｨｰ", "ﾊ")).toEqual([m("ﾊﾟ"), n("ｰﾃｨｰ")]);
    expect(splitByMatch("パーティー", "ﾊ")).toEqual([m("パ"), n("ーティー")]);
  });
  it("何度も出れば全部囲む", () => {
    expect(splitByMatch("abab", "ab")).toEqual([m("ab"), m("ab")]);
  });
  it("見つからない、空のときは印を付けない", () => {
    expect(splitByMatch("会議", "旅行")).toEqual([n("会議")]);
    expect(splitByMatch("会議", "")).toEqual([n("会議")]);
    expect(splitByMatch("", "a")).toEqual([n("")]);
  });
});
