import { showLab } from "@server/core/app";
import { describe, expect, it } from "vitest";

describe("showLab。ラボの欄を出すか。0039、F-35", () => {
  it("本番だけ出さない", () => {
    expect(showLab("production")).toBe(false);
  });

  it("staging と手元の開発は出す", () => {
    expect(showLab("staging")).toBe(true);
    expect(showLab("development")).toBe(true);
  });
});
