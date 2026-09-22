import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { needsEmailVerification, useAuth } from "@/app/auth";
import { Loading } from "@/app/guards";
import { AuthCard, AuthShell, AuthText, AuthTitle, Notice } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
// biome-ignore lint/style/noRestrictedImports: エラーの型 ApiError だけを使う。api() 本体は ./api から呼ぶ
import { ApiError } from "@/api/client";
import { postAgreement } from "@/modules/auth/AgreePage";
import { takeRememberedAgreement } from "@/modules/auth/pending-agreement";
import { useAcceptInvite, useInviteInfo } from "./api";

/**
 * 招待リンクを開いた画面。ログインしていなくても、どのグループへの招待かは見られる。F-12
 * ログインしていなければ、ログインか登録へ進み、終わったらこの画面に戻る。
 */
export function InvitePage() {
  const { token = "" } = useParams();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const info = useInviteInfo(token);
  const acceptInvite = useAcceptInvite(token);
  const busy = acceptInvite.isPending;
  const here = encodeURIComponent(`/invite/${token}`);
  const signedIn = user !== null && !needsEmailVerification(user);

  async function accept() {
    setError(null);
    try {
      // 登録の画面で同意して、そのまま招待に戻ってきたとき。先に同意を送る
      if (takeRememberedAgreement(user?.email)) await postAgreement();
      const { groupId } = await acceptInvite.mutateAsync();
      navigate(`/?group=${groupId}`, { replace: true });
    } catch (e) {
      // 規約に同意していなければ、同意してからこの画面に戻す
      if (e instanceof ApiError && e.code === "LEGAL_NOT_AGREED") {
        navigate(`/agree?next=${here}`);
        return;
      }
      setError((e as Error).message);
    }
  }

  if (info.isPending || !ready) return <Loading />;
  return (
    <AuthShell>
      <AuthCard>
        {info.error ? (
          <>
            <AuthTitle>招待リンクを開けません</AuthTitle>
            <AuthText>{info.error.message}</AuthText>
          </>
        ) : !info.data.valid ? (
          <>
            <AuthTitle>招待リンクを使えません</AuthTitle>
            <AuthText>
              {info.data.reason === "revoked" ? "このリンクは取り消されています。" : "このリンクは期限が切れています。"}
              リンクを送った人に、新しいリンクを頼んでください。
            </AuthText>
          </>
        ) : (
          <>
            <AuthTitle>「{info.data.groupName}」への招待</AuthTitle>
            <AuthText>参加すると、このグループの予定を一緒に見たり、足したりできます。</AuthText>
            {error && <Notice error>{error}</Notice>}
            {signedIn ? (
              <Button disabled={busy} onClick={accept}>
                参加する
              </Button>
            ) : (
              <>
                <Button asChild>
                  <Link to={`/login?next=${here}`}>ログインして参加する</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to={`/signup?next=${here}`}>アカウントを作って参加する</Link>
                </Button>
              </>
            )}
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
