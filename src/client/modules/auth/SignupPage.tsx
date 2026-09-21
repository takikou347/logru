import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthCard, AuthShell, AuthTitle, GoogleButton, Notice, OrDivider } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH, authErrorMessage } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";
import { safeNext } from "@/lib/utils";
import { signInWithGoogle } from "./google";
import { forgetAgreement, rememberAgreement } from "./pending-agreement";

/**
 * 登録の画面。メールとパスワードで作るか、Google で作る。F-01、F-16
 *
 * メールで作ったときは、確認メールを送り、確かめるまで待つ画面へ移る。
 * モバイルアプリで Google 以外の手段が要るので、独自のアカウントも作れるようにする。0004
 */
export function SignupPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("利用規約とプライバシーポリシーに同意してください。");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`パスワードは ${MIN_PASSWORD_LENGTH} 文字以上にしてください。`);
      return;
    }
    setBusy(true);
    setError(null);
    // 確かめ終えた瞬間に画面が移るので、同意は先に覚えておく
    rememberAgreement(email);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name.trim() });
      await sendEmailVerification(user, { url: `${location.origin}/verify-email?next=${encodeURIComponent(next)}` });
      navigate(`/verify-email?next=${encodeURIComponent(next)}`, { replace: true });
    } catch (err) {
      forgetAgreement();
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle();
      // Google で作った人は、この後で同意の画面を出す
      navigate(next, { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthTitle>アカウントを作る</AuthTitle>
        <GoogleButton onClick={google}>Google で登録</GoogleButton>
        <OrDivider />
        <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
          <Field label="表示名" hint="グループのメンバーに見える名前です。">
            {(p) => <Input {...p} autoComplete="nickname" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="メールアドレス">
            {(p) => (
              <Input {...p} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="パスワード" hint={`${MIN_PASSWORD_LENGTH} 文字以上にしてください。`}>
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
          <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
            <Checkbox className="mt-0.5 size-5" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} aria-label="利用規約とプライバシーポリシーに同意する" />
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
          {error && <Notice error>{error}</Notice>}
          <Button type="submit" className="w-full" disabled={busy || !name.trim() || !email || !password}>
            {busy ? "登録しています" : "登録する"}
          </Button>
        </form>
        <p className="text-xs leading-relaxed text-ink-2">Google で登録した場合は、最初に規約への同意を確かめます。</p>
        <Link className="text-[13px]" to="/login">
          ログインの画面へ
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
