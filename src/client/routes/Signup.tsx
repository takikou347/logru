import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { authClient, authErrorMessage } from "../lib/auth-client";
import { useConfig } from "../lib/queries";
import { Field, TextInput } from "../ui/controls";
import { AuthShell, GoogleMark, safeNext } from "./AuthShell";

export function Signup() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const config = useConfig();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const callbackURL = `/verify?next=${encodeURIComponent(next)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("利用規約とプライバシーポリシーに同意してください。");
      return;
    }
    setBusy(true);
    setError(null);
    const body = { name: name.trim(), email, password, callbackURL, agreedToLegal: true };
    const { error } = await authClient.signUp.email(body as Parameters<typeof authClient.signUp.email>[0]);
    setBusy(false);
    if (error) {
      setError(authErrorMessage(error as Parameters<typeof authErrorMessage>[0]));
      return;
    }
    setSentTo(email);
  }

  async function resend() {
    if (!sentTo) return;
    await authClient.sendVerificationEmail({ email: sentTo, callbackURL });
    setResent(true);
  }

  if (sentTo) {
    return (
      <AuthShell>
        <section className="card glass" aria-live="polite">
          <h1>確認メールを送りました</h1>
          <p>
            {sentTo} に届いたメールのリンクを開くと、登録が終わります。リンクは 24 時間で切れます。
          </p>
          <p className="hint">届かないときは、迷惑メールのフォルダも見てください。</p>
          <button className="btn glassy" type="button" onClick={resend} disabled={resent}>
            {resent ? "もう一度送りました" : "メールをもう一度送る"}
          </button>
          <Link to="/login">ログインの画面へ</Link>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form className="card glass" onSubmit={submit} noValidate>
        <h1>アカウントを作る</h1>
        <Field label="表示名" hint="グループのメンバーに見える名前です。">
          {(p) => (
            <TextInput {...p} autoComplete="nickname" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field label="メールアドレス">
          {(p) => (
            <TextInput {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </Field>
        <Field label="パスワード" hint="8 文字以上にしてください。">
          {(p) => (
            <TextInput
              {...p}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            <Link to="/terms" target="_blank">
              利用規約
            </Link>
            と
            <Link to="/privacy" target="_blank">
              プライバシーポリシー
            </Link>
            に同意する
          </span>
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="submit" disabled={busy || !name.trim() || !email || password.length < 8}>
          {busy ? "登録しています" : "登録する"}
        </button>
        {config.data?.googleEnabled && (
          <>
            <div className="or">または</div>
            <button
              type="button"
              className="gbtn"
              onClick={() =>
                authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login" })
              }
            >
              <GoogleMark />
              Google で登録
            </button>
            <p className="hint">Google で登録した場合は、最初に規約への同意を確かめます。</p>
          </>
        )}
        <div className="links">
          <Link to="/login">ログインの画面へ</Link>
        </div>
      </form>
    </AuthShell>
  );
}
