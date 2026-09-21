import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { InviteInfo } from "../../../shared/api-types";
import { needsEmailVerification, useAuth } from "@/app/auth";
import { Loading } from "@/app/guards";
import { AuthCard, AuthShell, AuthText, AuthTitle, Notice } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { keys } from "@/lib/queries";

/**
 * 招待リンクを開いた画面。ログインしていなくても、どのグループへの招待かは見られる。F-12
 * ログインしていなければ、ログインか登録へ進み、終わったらこの画面に戻る。
 */
export function InvitePage() {
  const { token = "" } = useParams();
  const { user, ready } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const info = useQuery({ queryKey: keys.invite(token), queryFn: () => api<InviteInfo>(`/invites/${token}`) });
  const here = encodeURIComponent(`/invite/${token}`);
  const signedIn = user !== null && !needsEmailVerification(user);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { groupId } = await api<{ groupId: string }>(`/invites/${token}/accept`, { method: "POST" });
      await qc.invalidateQueries();
      navigate(`/?group=${groupId}`, { replace: true });
    } catch (e) {
      // 規約に同意していなければ、同意してからこの画面に戻す
      if (e instanceof ApiError && e.code === "LEGAL_NOT_AGREED") {
        navigate(`/agree?next=${here}`);
        return;
      }
      setError((e as Error).message);
      setBusy(false);
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
