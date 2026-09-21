import { auth } from "./firebase";

/** API が失敗したとき。message は画面にそのまま出せる文 */
export class ApiError extends Error {
  /**
   * @param status HTTP の状態。通信できなかったときは 0
   * @param message 画面に出す文
   * @param code サーバーが付けた印。分岐に使う。例は `LEGAL_NOT_AGREED`
   */
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

const OFFLINE_MESSAGE = "通信できません。つながってから、もう一度試してください。";

type Options = {
  method?: string;
  body?: unknown;
  /** 画面を閉じても送り切る。消すのを後で送るときに使う */
  keepalive?: boolean;
  /** このトークンを使う。Firebase のアカウントを消した後に、最後の要求を送るときに渡す */
  token?: string;
};

async function send(path: string, opts: Options, forceRefresh: boolean): Promise<Response> {
  const token = opts.token ?? (await auth.currentUser?.getIdToken(forceRefresh));
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    keepalive: opts.keepalive,
  });
}

/**
 * `/api` の下を呼ぶ。ログインしていれば Firebase の ID トークンを付ける。
 *
 * トークンの期限切れで 401 になったら、1 度だけ取り直して送り直す。
 *
 * @param path `/api` の後ろのパス。例は `/me`
 * @throws {ApiError} 失敗したとき。通信できなければ status が 0
 * @example const me = await api<Me>("/me");
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await send(path, opts, false);
    if (res.status === 401 && !opts.token && auth.currentUser) res = await send(path, opts, true);
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "うまくいきませんでした。もう一度試してください。", data.code);
  }
  return data as T;
}

/** ログアウトや退会のとき、端末に残した API の控えを消す。共有の端末で前の人の予定を見せない */
export async function clearApiCache(): Promise<void> {
  try {
    await caches?.delete("api");
  } catch {
    // キャッシュが使えない環境では何もしない
  }
}
