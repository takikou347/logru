/**
 * ログインが切れたことを、ログインの画面に伝える印。0025
 *
 * 切れたらログアウトし、ログインが要る画面の入口がログインへ移す。
 * ログインの画面は、この印があれば「ログインが切れました」と出す。
 */
let expired = false;

/** ログインが切れたと印を付ける */
export function markSessionExpired(): void {
  expired = true;
}

/** 印を読んで消す。ログインの画面を開いたときに 1 度だけ呼ぶ */
export function takeSessionExpired(): boolean {
  const was = expired;
  expired = false;
  return was;
}

/** 印が付いているか。消さずに読む。同じ切れ目で何度もログアウトしないために使う */
export function isSessionExpired(): boolean {
  return expired;
}
