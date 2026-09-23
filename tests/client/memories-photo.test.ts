import { describe, expect, it } from "vitest";
import { smallSrc } from "../../src/extensions/memories/client/parts";
import type { Photo } from "../../src/extensions/memories/shared/types";

const base: Photo = {
  id: "p1",
  width: 100,
  height: 100,
  takenAt: null,
  tiny: "data:image/jpeg;base64,tiny",
  small: null,
  thumbUrl: null,
  fullUrl: "https://example.test/full",
};

describe("smallSrc。一覧に出す小さな画像を選ぶ。0021、#158", () => {
  it("small があれば、それを使う。往復が要らない", () => {
    expect(smallSrc({ ...base, small: "data:image/jpeg;base64,small", thumbUrl: "https://example.test/thumb" })).toBe(
      "data:image/jpeg;base64,small",
    );
  });

  it("small が無ければ、この形に変える前の写真として thumbUrl を使う", () => {
    expect(smallSrc({ ...base, small: null, thumbUrl: "https://example.test/thumb" })).toBe(
      "https://example.test/thumb",
    );
  });

  it("small も thumbUrl も無ければ fullUrl まで落ちる", () => {
    expect(smallSrc({ ...base, small: null, thumbUrl: null })).toBe("https://example.test/full");
  });
});
