import type { DB } from "../db/client";
import { devMails } from "../db/schema";

export type Mail = { to: string; subject: string; text: string };

/**
 * RESEND_API_KEY があれば Resend で送る。
 * 無ければ、本番以外に限り dev_mails に控えを残す。E2E テストはそれを読む。
 */
export async function sendMail(env: Env, db: DB, mail: Mail): Promise<void> {
  const apiKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY;
  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) throw new Error(`メールを送れなかった: ${res.status} ${await res.text()}`);
    return;
  }
  if (env.ENVIRONMENT === "production") throw new Error("RESEND_API_KEY が無い");
  await db.insert(devMails).values(mail);
  console.log(`[mail] ${mail.to} ${mail.subject}\n${mail.text}`);
}

export function verificationMail(to: string, url: string): Mail {
  return {
    to,
    subject: "Logru のメールアドレスを確かめてください",
    text: [
      "Logru に登録いただき、ありがとうございます。",
      "次のリンクを開くと、登録が終わります。リンクは 24 時間で切れます。",
      "",
      url,
      "",
      "心当たりが無い場合は、このメールを消してください。",
    ].join("\n"),
  };
}

export function resetPasswordMail(to: string, url: string): Mail {
  return {
    to,
    subject: "Logru のパスワードを再設定してください",
    text: [
      "パスワードの再設定を受け付けました。",
      "次のリンクから、新しいパスワードを入れてください。リンクは 1 時間で切れます。",
      "",
      url,
      "",
      "心当たりが無い場合は、このメールを消してください。パスワードは変わりません。",
    ].join("\n"),
  };
}
