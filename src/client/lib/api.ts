export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const OFFLINE_MESSAGE = "通信できません。つながってから、もう一度試してください。";

export async function api<T>(path: string, init: { method?: string; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      keepalive: init.keepalive,
    });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = (data.error ?? data.message ?? "うまくいきませんでした。もう一度試してください。") as string;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}
