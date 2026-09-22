import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getIdToken = vi.fn<(force?: boolean) => Promise<string>>();
const fakeAuth: { currentUser: { getIdToken: typeof getIdToken } | null } = { currentUser: { getIdToken } };

vi.mock("../../src/client/lib/firebase", () => ({ auth: fakeAuth }));

const { ApiError, api, setApiFailureHandlers } = await import("../../src/client/api/client");

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

  it("端末がオフラインなら、つながってからと伝える", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api("/me")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("つながってから") });
  });

  it("端末がオンラインなのに届かなければ、サーバーにつながらないと伝える", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api("/me")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("サーバーにつながりませんでした") });
  });

  it("500 以上で文が無ければ、サーバーの失敗と伝える", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }));
    await expect(api("/me")).rejects.toMatchObject({ status: 502, message: expect.stringContaining("サーバーでうまくいきませんでした") });
  });

  describe("アプリ全体で受ける失敗", () => {
    const onSessionExpired = vi.fn();
    const onLegalRequired = vi.fn();
    beforeEach(() => setApiFailureHandlers({ onSessionExpired, onLegalRequired }));
    afterEach(() => {
      setApiFailureHandlers({});
      onSessionExpired.mockReset();
      onLegalRequired.mockReset();
    });

    it("取り直しても 401 なら、ログインが切れたと知らせる", async () => {
      fetchMock.mockResolvedValue(json(401, { error: "ログインし直してください。" }));
      await expect(api("/me")).rejects.toMatchObject({ status: 401 });
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    it("トークンを取り直せなければ、ログインが切れたと知らせる", async () => {
      fetchMock.mockResolvedValueOnce(json(401, { error: "x" }));
      getIdToken.mockImplementation(async (force) => {
        if (force) throw Object.assign(new Error("expired"), { code: "auth/user-token-expired" });
        return "old-token";
      });
      await expect(api("/me")).rejects.toMatchObject({ status: 401, code: "SESSION_EXPIRED" });
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });

    it("トークンの取り直しが通信で失敗したら、ログインは切れたことにしない", async () => {
      fetchMock.mockResolvedValueOnce(json(401, { error: "x" }));
      getIdToken.mockImplementation(async (force) => {
        if (force) throw Object.assign(new Error("offline"), { code: "auth/network-request-failed" });
        return "old-token";
      });
      await expect(api("/me")).rejects.toMatchObject({ status: 0 });
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("ログインしていない 401 では知らせない", async () => {
      fakeAuth.currentUser = null;
      fetchMock.mockResolvedValue(json(401, { error: "x" }));
      await expect(api("/me")).rejects.toBeInstanceOf(ApiError);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("規約の同意が要ると返されたら、同意が要ると知らせる", async () => {
      fetchMock.mockResolvedValueOnce(json(403, { error: "規約に同意してください。", code: "LEGAL_NOT_AGREED" }));
      await expect(api("/groups", { method: "POST", body: { name: "x" } })).rejects.toMatchObject({ status: 403 });
      expect(onLegalRequired).toHaveBeenCalledTimes(1);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });
  });
});
