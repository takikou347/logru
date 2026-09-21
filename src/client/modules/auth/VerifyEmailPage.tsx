import { sendEmailVerification } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { needsEmailVerification, useAuth } from "@/app/auth";
import { AuthCard, AuthShell, AuthText, AuthTitle, Notice } from "@/components/AuthShell";
import { useSignOut } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeNext } from "@/lib/utils";

/** 確かめたかを見に行く間隔。画面を開いている間だけ見る */
const POLL_MS = 5000;

/**
 * メールアドレスを確かめるまで待つ画面。F-01
 *
 * 確認メールのリンクは Firebase の画面で開く。確かめ終えたら、この画面が気づいて次へ進む。
 * 気づかないときのために「確かめた」のボタンも置く。
 */
export function VerifyEmailPage() {
  const { user, ready } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const doSignOut = useSignOut();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!user) return false;
    await user.reload();
    if (!user.emailVerified) return false;
    // 確かめたことをトークンに載せる。サーバーはトークンの中身で判断する
    await user.getIdToken(true);
    navigate(next, { replace: true });
    return true;
  }, [user, navigate, next]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [check]);

  if (!ready) return <div className="grid min-h-[60dvh] place-items-center text-sm text-ink-2">読み込んでいます</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!needsEmailVerification(user)) return <Navigate to={next} replace />;

  async function resend() {
    setError(null);
    try {
      await sendEmailVerification(user!, { url: `${location.origin}/verify-email?next=${encodeURIComponent(next)}` });
      setMessage("確認メールをもう一度送りました。");
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <AuthShell>
      <AuthCard aria-live="polite">
        <AuthTitle>確認メールを送りました</AuthTitle>
        <AuthText>{user.email} に届いたメールのリンクを開くと、登録が終わります。</AuthText>
        <p className="text-xs leading-relaxed text-ink-2">届かないときは、迷惑メールのフォルダも見てください。</p>
        {message && <Notice>{message}</Notice>}
        {error && <Notice error>{error}</Notice>}
        <Button
          onClick={async () => {
            if (!(await check())) setError("まだ確かめられていません。メールのリンクを開いてから、もう一度押してください。");
          }}
        >
          確かめた
        </Button>
        <Button variant="secondary" onClick={resend}>
          メールをもう一度送る
        </Button>
        <Button variant="ghost" onClick={doSignOut}>
          別のアカウントでログインする
        </Button>
      </AuthCard>
    </AuthShell>
  );
}
