import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authClient, authErrorMessage } from "../lib/auth-client";
import { useConfig } from "../lib/queries";
import { Field, TextInput } from "../ui/controls";
import { AuthShell, GoogleMark, safeNext } from "./AuthShell";

const URL_ERRORS: Record<string, string> = {
  account_not_linked:
    "このメールアドレスは登録済みで、まだ確かめられていません。届いたメールのリンクを開いてから、もう一度 Google でログインしてください。",
  "account not linked":
    "このメールアドレスは登録済みで、まだ確かめられていません。届いたメールのリンクを開いてから、もう一度 Google でログインしてください。",
};

export function Login() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const config = useConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const e = params.get("error");
    return e ? (URL_ERRORS[e] ?? "ログインできませんでした。もう一度試してください。") : null;
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) {
      setError(authErrorMessage(error as Parameters<typeof authErrorMessage>[0]));
      return;
    }
    await qc.invalidateQueries();
    navigate(next, { replace: true });
  }

  async function google() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
    });
  }

  return (
    <AuthShell>
      <form className="card glass" onSubmit={submit} noValidate>
        <h1 className="sr-only">ログイン</h1>
        <Field label="メールアドレス">
          {(p) => (
            <TextInput
              {...p}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="パスワード" error={error}>
          {(p) => (
            <TextInput
              {...p}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
        </Field>
        <button className="btn primary block" type="submit" disabled={busy || !email || !password}>
          {busy ? "ログインしています" : "ログイン"}
        </button>
        {config.data?.googleEnabled && (
          <>
            <div className="or">または</div>
            <button type="button" className="gbtn" onClick={google}>
              <GoogleMark />
              Google でログイン
            </button>
          </>
        )}
        <div className="links">
          <Link to={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>アカウントを作る</Link>
          <Link to="/reset-password">パスワードを忘れた</Link>
        </div>
      </form>
    </AuthShell>
  );
}
