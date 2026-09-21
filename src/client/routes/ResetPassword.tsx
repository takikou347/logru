import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { authClient, authErrorMessage } from "../lib/auth-client";
import { Field, TextInput } from "../ui/controls";
import { AuthShell } from "./AuthShell";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");
  if (linkError) {
    return (
      <AuthShell>
        <section className="card glass">
          <h1>リンクを使えませんでした</h1>
          <p>リンクの期限が切れているか、すでに使われています。もう一度、再設定のメールを頼んでください。</p>
          <Link className="btn primary" to="/reset-password">
            再設定のメールを頼む
          </Link>
        </section>
      </AuthShell>
    );
  }
  return token ? <NewPassword token={token} /> : <RequestReset />;
}

function RequestReset() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    if (error) setError(authErrorMessage(error as Parameters<typeof authErrorMessage>[0]));
    else setSent(true);
  }

  if (sent) {
    return (
      <AuthShell>
        <section className="card glass" aria-live="polite">
          <h1>メールを送りました</h1>
          <p>{email} が登録されていれば、再設定のリンクが届きます。リンクは 1 時間で切れます。</p>
          <Link to="/login">ログインの画面へ</Link>
        </section>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <form className="card glass" onSubmit={submit} noValidate>
        <h1>パスワードを再設定する</h1>
        <p>登録したメールアドレスに、再設定のリンクを送ります。</p>
        <Field label="メールアドレス" error={error}>
          {(p) => (
            <TextInput {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <button className="btn primary block" type="submit" disabled={busy || !email}>
          {busy ? "送っています" : "メールを送る"}
        </button>
        <Link to="/login">ログインの画面へ</Link>
      </form>
    </AuthShell>
  );
}

function NewPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (error) setError(authErrorMessage(error as Parameters<typeof authErrorMessage>[0]));
    else setDone(true);
  }

  if (done) {
    return (
      <AuthShell>
        <section className="card glass" aria-live="polite">
          <h1>パスワードを変えました</h1>
          <p>新しいパスワードでログインしてください。ほかの端末ではログアウトしています。</p>
          <Link className="btn primary" to="/login">
            ログインする
          </Link>
        </section>
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      <form className="card glass" onSubmit={submit} noValidate>
        <h1>新しいパスワード</h1>
        <Field label="新しいパスワード" error={error} hint="8 文字以上にしてください。">
          {(p) => (
            <TextInput {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </Field>
        <button className="btn primary block" type="submit" disabled={busy || password.length < 8}>
          {busy ? "変えています" : "パスワードを変える"}
        </button>
      </form>
    </AuthShell>
  );
}
