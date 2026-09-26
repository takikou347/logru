import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientErrorReporter, describeError } from "../../src/client/lib/error-report";

describe("describeError", () => {
  it("Error からメッセージとスタックを取り出す", () => {
    const e = new Error("boom");
    expect(describeError(e)).toEqual({ message: "boom", stack: e.stack });
  });

  it("メッセージが無い Error は名前を使う", () => {
    const e = new TypeError();
    expect(describeError(e).message).toBe("TypeError");
  });

  it("文字列はそのままメッセージにする", () => {
    expect(describeError("oops")).toEqual({ message: "oops" });
  });

  it("それ以外の値は JSON にする", () => {
    expect(describeError({ code: 1 })).toEqual({ message: JSON.stringify({ code: 1 }) });
  });
});

describe("ClientErrorReporter。同じ文言は 1 分に 1 度まで、1 回の読み込みで 20 件まで。0040", () => {
  const sendBeacon = vi.fn().mockReturnValue(true);
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));

  beforeEach(() => {
    vi.stubGlobal("location", { pathname: "/groups" });
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sendBeacon.mockReset().mockReturnValue(true);
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  });

  it("sendBeacon があれば、それで送る。fetch は呼ばない", () => {
    new ClientErrorReporter().report("Boom");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]![0]).toBe("/api/client-errors");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendBeacon が無ければ fetch(keepalive) で送る", () => {
    vi.stubGlobal("navigator", {});
    new ClientErrorReporter().report("Boom");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/client-errors");
    expect(init).toMatchObject({ method: "POST", keepalive: true });
  });

  it("同じ文言は 1 分は送らない。1 分過ぎればまた送る", () => {
    let now = 0;
    const reporter = new ClientErrorReporter(20, 60_000, () => now);
    reporter.report("Boom");
    reporter.report("Boom");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    now = 59_999;
    reporter.report("Boom");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    now = 60_000;
    reporter.report("Boom");
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });

  it("文言が違えば、間引かずそれぞれ送る", () => {
    const reporter = new ClientErrorReporter();
    reporter.report("A");
    reporter.report("B");
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });

  it("1 回の読み込みで 20 件を超えると、それ以上は送らない", () => {
    const reporter = new ClientErrorReporter();
    for (let i = 0; i < 25; i++) reporter.report(`message-${i}`);
    expect(sendBeacon).toHaveBeenCalledTimes(20);
  });

  it("上限は文言によらず、1 回の読み込み全体で数える", () => {
    let now = 0;
    const reporter = new ClientErrorReporter(2, 60_000, () => now);
    reporter.report("A");
    now = 60_001;
    reporter.report("B");
    now = 120_002;
    reporter.report("C"); // 3 件目。間引きの間隔は過ぎているが、読み込みの上限には当たる
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });

  it("送るのに失敗しても投げない", () => {
    vi.stubGlobal("navigator", {});
    fetchMock.mockRejectedValue(new Error("network"));
    expect(() => new ClientErrorReporter().report("Boom")).not.toThrow();
  });

  it("報告そのものが例外を投げても、外へは投げない", () => {
    vi.stubGlobal("location", null);
    expect(() => new ClientErrorReporter().report("Boom")).not.toThrow();
  });

  it("メッセージは 500 文字までに切る", async () => {
    new ClientErrorReporter().report("x".repeat(600));
    const blob = sendBeacon.mock.calls[0]![1] as Blob;
    const body = JSON.parse(await blob.text());
    expect(body.message).toHaveLength(500);
  });

  it("スタックは先頭の 10 行だけ送る", async () => {
    const stack = Array.from({ length: 20 }, (_, i) => `at frame${i}`).join("\n");
    new ClientErrorReporter().report("Boom", stack);
    const blob = sendBeacon.mock.calls[0]![1] as Blob;
    const body = JSON.parse(await blob.text());
    expect(body.stack.split("\n")).toHaveLength(10);
    expect(body.stack.split("\n")[0]).toBe("at frame0");
  });

  it("URL のパス(クエリを含めない)と組み立ての版を載せる", async () => {
    vi.stubGlobal("location", { pathname: "/groups/1" });
    new ClientErrorReporter().report("Boom");
    const blob = sendBeacon.mock.calls[0]![1] as Blob;
    const body = JSON.parse(await blob.text());
    expect(body.path).toBe("/groups/1");
    expect(typeof body.buildVersion).toBe("string");
    expect(body.buildVersion.length).toBeGreaterThan(0);
  });
});
