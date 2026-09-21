import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ basePath: "/api/auth" });

type AuthErrorLike = { status?: number; code?: string; message?: string; remaining?: number; lockedUntil?: number } | null;

/** Better Auth の失敗を、画面に出す文にする */
export function authErrorMessage(error: AuthErrorLike): string {
  if (!error) return "";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return typeof error.remaining === "number"
        ? `メールアドレスかパスワードが違います。あと ${error.remaining} 回違うと 15 分ログインできません。`
        : "メールアドレスかパスワードが違います。";
    case "LOGIN_LOCKED": {
      const until = error.lockedUntil ? new Date(error.lockedUntil) : null;
      const at = until ? `${until.getHours()}:${String(until.getMinutes()).padStart(2, "0")}` : "15 分後";
      return `続けて間違えたため、ログインを止めています。${at} から、もう一度試せます。`;
    }
    case "EMAIL_NOT_VERIFIED":
      return "メールアドレスがまだ確かめられていません。届いたメールのリンクを開いてください。";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "このメールアドレスは登録済みです。ログインするか、パスワードを再設定してください。";
    case "PASSWORD_TOO_SHORT":
      return "パスワードは 8 文字以上にしてください。";
    case "PASSWORD_TOO_LONG":
      return "パスワードは 128 文字までにしてください。";
    case "INVALID_EMAIL":
      return "メールアドレスの形が違います。";
    case "INVALID_TOKEN":
      return "リンクの期限が切れているか、すでに使われています。もう一度やり直してください。";
    case "LEGAL_NOT_AGREED":
      return "利用規約とプライバシーポリシーに同意してください。";
    default:
      if (error.status === 429) return "短い時間に何度も試されました。少し待ってから試してください。";
      return error.message || "うまくいきませんでした。もう一度試してください。";
  }
}
