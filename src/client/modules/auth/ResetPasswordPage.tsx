import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { type FormEvent, useState } from "react";
import { AuthCard, AuthShell, AuthText, AuthTitle, Notice } from "@/components/AuthShell";
import { BackButton } from "@/components/BackButton";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authErrorMessage } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";

/**
 * パスワードの再設定を頼む画面。F-03
 *
 * 再設定のメールは Firebase が送る。新しいパスワードは Firebase の画面で入れる。
 * 登録されていないアドレスでも同じ文を出し、登録されているかを探られないようにする。
 */
export function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email, { url: `${location.origin}/login` });
      setSent(true);
    } catch (err) {
      if (err instanceof FirebaseError && err.code === "auth/user-not-found") setSent(true);
      else setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell back={<BackButton to="/login" label="ログインの画面へ戻る" />}>
      {sent ? (
        <AuthCard aria-live="polite">
          <AuthTitle>メールを送りました</AuthTitle>
          <AuthText>{email} が登録されていれば、再設定のリンクが届きます。リンクから新しいパスワードを入れてください。</AuthText>
        </AuthCard>
      ) : (
        <AuthCard>
          <AuthTitle>パスワードを再設定する</AuthTitle>
          <AuthText>登録したメールアドレスに、再設定のリンクを送ります。</AuthText>
          <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
            <Field label="メールアドレス">
              {(p) => (
                <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            {error && <Notice error>{error}</Notice>}
            <Button type="submit" disabled={busy || !email}>
              {busy ? "送っています" : "メールを送る"}
            </Button>
          </form>
        </AuthCard>
      )}
    </AuthShell>
  );
}
