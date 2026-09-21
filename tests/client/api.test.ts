import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getIdToken = vi.fn<(force?: boolean) => Promise<string>>();
const fakeAuth: { currentUser: { getIdToken: typeof getIdToken } | null } = { currentUser: { getIdToken } };

vi.mock("../../src/client/lib/firebase", () => ({ auth: fakeAuth }));

const { ApiError, api } = await import("../../src/client/lib/api");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fakeAuth.currentUser = { getIdToken };
    getIdToken.mockImplementation(async (force) => (force ? "fresh-token" : "old-token"));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    getIdToken.mockReset();
  });

  const authHeader = (call: number) => (fetchMock.mock.calls[call]![1]!.headers as Record<string, string>).Authorization;

  it("ID トークンを Bearer で付ける", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api("/me")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/me");
    expect(authHeader(0)).toBe("Bearer old-token");
  });

  it("401 なら 1 度だけトークンを取り直して送り直す", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: "x" })).mockResolvedValueOnce(json(200, { ok: true }));
    await expect(api("/me")).resolves.toEqual({ ok: true });
    expect(getIdToken).toHaveBeenLastCalledWith(true);
    expect(authHeader(1)).toBe("Bearer fresh-token");
  });

  it("取り直しても 401 なら、それ以上は送らずに失敗にする", async () => {
    fetchMock.mockResolvedValue(json(401, { error: "ログインしてください。", code: "UNAUTHORIZED" }));
    const error = (await api("/me").catch((e: unknown) => e)) as InstanceType<typeof ApiError>;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ログインしていなければ、トークンを付けず、送り直さない", async () => {
    fakeAuth.currentUser = null;
    fetchMock.mockResolvedValue(json(401, { error: "x" }));
    await expect(api("/me")).rejects.toBeInstanceOf(ApiError);
    expect(authHeader(0)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("サーバーの印とメッセージを ApiError に載せる", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { error: "規約に同意してください。", code: "LEGAL_NOT_AGREED" }));
    const error = await api("/groups", { method: "POST", body: { name: "x" } }).catch((e) => e);
    expect(error).toMatchObject({ status: 403, code: "LEGAL_NOT_AGREED", message: "規約に同意してください。" });
  });

  it("通信できなければ status 0", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api("/me")).rejects.toMatchObject({ status: 0 });
  });
});
