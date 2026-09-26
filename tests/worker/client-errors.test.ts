import { CLIENT_ERROR_BODY_MAX_BYTES, clientErrorRoutes } from "@server/modules/client-errors/routes";
import { afterEach, describe, expect, it, vi } from "vitest";

const post = (
  body: BodyInit,
  headers: Record<string, string> = { "Content-Type": "application/json" },
  env?: Record<string, unknown>,
) => clientErrorRoutes.request("/", { method: "POST", headers, body }, env);

describe("POST /api/client-errors。ログイン前にも送るので、ログインは求めない。0040", () => {
  afterEach(() => vi.restoreAllMocks());

  it("正しい形なら 204 で受け、探しやすい形で console.error に出す。何も返さない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(
      JSON.stringify({ path: "/groups", message: "Boom", stack: "at x\nat y", buildVersion: "abc1234" }),
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]![0] as string;
    expect(line).toContain("[client-error]");
    expect(line).toContain("version=abc1234");
    expect(line).toContain("path=/groups");
    expect(line).toContain("message=Boom");
    expect(line).toContain("at x");
  });

  it("stack が無くても通す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(JSON.stringify({ path: "/", message: "Boom", buildVersion: "abc1234" }));
    expect(res.status).toBe(204);
  });

  it("本文が上限を超えると、読まずに 413 で断る", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const big = "x".repeat(CLIENT_ERROR_BODY_MAX_BYTES + 1024);
    const res = await post(JSON.stringify({ path: "/", message: big, buildVersion: "abc1234" }));
    expect(res.status).toBe(413);
    expect(spy).not.toHaveBeenCalled();
  });

  it("必須の項目が欠けていると、保存も出力もせず 400 で断る", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(JSON.stringify({ message: "no path", buildVersion: "abc1234" }));
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("path が空文字だと 400 で断る", async () => {
    const res = await post(JSON.stringify({ path: "", message: "x", buildVersion: "abc1234" }));
    expect(res.status).toBe(400);
  });

  it("JSON として壊れていても、投げずに断る", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post("{not valid json");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("Authorization を付けなくても受け付ける。ログイン前の誤りも送れる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await clientErrorRoutes.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "/login", message: "x", buildVersion: "abc1234" }),
    });
    expect(res.status).toBe(204);
  });

  it("束縛が無ければ、上限に当たらず通す。手元と E2E はこれ。0065、#161", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(JSON.stringify({ path: "/", message: "x", buildVersion: "abc1234" }), undefined, {});
    expect(res.status).toBe(204);
  });

  it("ログインを求めないので、IP を key にした上限を掛ける。0065、#161", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const limit = vi.fn().mockResolvedValue({ success: true });
    const headers = { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" };
    const res = await post(JSON.stringify({ path: "/", message: "x", buildVersion: "abc1234" }), headers, {
      CLIENT_ERROR_RATE_LIMIT: { limit },
    });
    expect(res.status).toBe(204);
    expect(limit).toHaveBeenCalledWith({ key: "203.0.113.9" });
  });

  it("上限に当たったら断り、何も出力しない。ステータスは enforceRateLimit 自体の rate-limit.test.ts で確かめる", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const limit = vi.fn().mockResolvedValue({ success: false });
    const res = await post(
      JSON.stringify({ path: "/", message: "x", buildVersion: "abc1234" }),
      { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
      { CLIENT_ERROR_RATE_LIMIT: { limit } },
    );
    // この router 単体には onError が無いので、本番でだけ載る index.ts の onError が付ける 429 にはならない
    expect(res.status).not.toBe(204);
    // 上限で断られ、探しやすい形の [client-error] のログには進んでいない
    expect(spy.mock.calls.some((call) => String(call[0]).includes("[client-error]"))).toBe(false);
  });
});
