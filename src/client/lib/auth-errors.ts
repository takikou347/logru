import { FirebaseError } from "firebase/app";

/**
 * Firebase の失敗を、画面に出す文にする。
 * どの欄が違うかを細かく言わない。登録されているかを探られないようにするため。
 * @param error Firebase の関数が投げたもの
 */
export function authErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "メールアドレスかパスワードが違います。";
    case "auth/too-many-requests":
      return "続けて間違えたため、しばらくログインを止めています。時間をおくか、パスワードを再設定してください。";
    case "auth/email-already-in-use":
      return "このメールアドレスは登録済みです。ログインするか、パスワードを再設定してください。";
    case "auth/invalid-email":
      return "メールアドレスの形が違います。";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "パスワードは 8 文字以上にしてください。";
    case "auth/user-disabled":
      return "このアカウントは使えません。お問い合わせください。";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google でのログインをやめました。もう一度ボタンを押すと、やり直せます。";
    case "auth/popup-blocked":
      return "ログインの窓が開けませんでした。ブラウザのポップアップの設定を確かめてください。";
    case "auth/network-request-failed":
      return "通信できません。つながってから、もう一度試してください。";
    case "auth/requires-recent-login":
      return "安全のため、もう一度ログインしてから試してください。";
    case "auth/account-exists-with-different-credential":
      return "このメールアドレスは、別の方法で登録されています。その方法でログインしてください。";
    default:
      return "うまくいきませんでした。時間をおいて、もう一度試してください。";
  }
}

/** パスワードの最短の長さ。Firebase の既定は 6 文字だが、このアプリは 8 文字にする */
export const MIN_PASSWORD_LENGTH = 8;
