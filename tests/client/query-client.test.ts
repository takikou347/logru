import { MutationObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getIdToken = vi.fn<(force?: boolean) => Promise<string>>();
const fakeAuth: { currentUser: { getIdToken: typeof getIdToken } | null } = { currentUser: { getIdToken } };

vi.mock("../../src/client/lib/firebase", () => ({ auth: fakeAuth }));

const { api } = await import("../../src/client/api/client");
const { queryClient } = await import("../../src/client/api/query-client");

describe("queryClient の mutations", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fakeAuth.currentUser = { getIdToken };
    getIdToken.mockImplementation(async () => "token");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    getIdToken.mockReset();
  });

  it("networkMode が always になっている", () => {
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBe("always");
  });

  it("オフラインでも mutation が保留のまま止まらず、api() の「通信できません」で失敗する", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const observer = new MutationObserver(queryClient, {
      mutationFn: () => api("/me", { method: "PATCH", body: { name: "x" } }),
    });

    await expect(observer.mutate()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("通信できません"),
    });
    // 保留(paused)ではなく、失敗として確定している
    expect(observer.getCurrentResult().status).toBe("error");
    expect(observer.getCurrentResult().isPaused).toBe(false);
  });
});
