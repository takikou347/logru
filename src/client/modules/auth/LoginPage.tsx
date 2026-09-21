import { signInWithEmailAndPassword } from "firebase/auth";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthCard, AuthShell, GoogleButton, Notice, OrDivider } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authErrorMessage } from "@/lib/auth-errors";
import { auth, usingEmulator } from "@/lib/firebase";
import { safeNext } from "@/lib/utils";
import { DevLogin } from "./DevLogin";
import { signInWithGoogle } from "./google";

/**
 * ログインの画面。Google か、メールとパスワード。F-02
 * 締め出しは Firebase が行う。続けて間違えると、しばらく止まる。
 */
export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = () => navigate(next, { replace: true });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      done();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle();
      done();
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  const withNext = (path: string) => (next !== "/" ? `${path}?next=${encodeURIComponent(next)}` : path);

  return (
    <AuthShell>
      <AuthCard>
        <h1 className="sr-only">ログイン</h1>
        <GoogleButton onClick={google}>Google でログイン</GoogleButton>
        <OrDivider />
        <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
          <Field label="メールアドレス">
            {(p) => (
              <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="パスワード">
            {(p) => (
              <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
          {error && <Notice error>{error}</Notice>}
          <Button type="submit" className="w-full" disabled={busy || !email || !password}>
            {busy ? "ログインしています" : "ログイン"}
          </Button>
        </form>
        <div className="flex flex-wrap justify-between gap-2 text-[13px]">
          <Link className="inline-flex min-h-8 items-center" to={withNext("/signup")}>
            アカウントを作る
          </Link>
          <Link className="inline-flex min-h-8 items-center" to="/reset-password">
            パスワードを忘れた
          </Link>
        </div>
        {usingEmulator && <DevLogin onDone={done} />}
      </AuthCard>
    </AuthShell>
  );
}
