import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { InviteInfo } from "../../shared/api-types";
import { api } from "../lib/api";
import { useMe } from "../lib/queries";
import { AuthShell } from "./AuthShell";

/** 招待リンクを開いた画面。ログインしていなくても見られる */
export function Invite() {
  const { token = "" } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const info = useQuery({ queryKey: ["invite", token], queryFn: () => api<InviteInfo>(`/invites/${token}`) });
  const here = `/invite/${token}`;

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { groupId } = await api<{ groupId: string }>(`/invites/${token}/accept`, { method: "POST" });
      await qc.invalidateQueries();
      navigate(`/?group=${groupId}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (info.isPending || me.isPending) return <div className="loading">読み込んでいます</div>;
  return (
    <AuthShell>
      <section className="card glass">
        {info.error ? (
          <>
            <h1>招待リンクを開けません</h1>
            <p>{info.error.message}</p>
          </>
        ) : !info.data.valid ? (
          <>
            <h1>招待リンクを使えません</h1>
            <p>
              {info.data.reason === "revoked" ? "このリンクは取り消されています。" : "このリンクは期限が切れています。"}
              リンクを送った人に、新しいリンクを頼んでください。
            </p>
          </>
        ) : (
          <>
            <h1>「{info.data.groupName}」への招待</h1>
            <p>参加すると、このグループの予定を一緒に見たり、足したりできます。</p>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {me.data ? (
              <button type="button" className="btn primary block" disabled={busy} onClick={accept}>
                参加する
              </button>
            ) : (
              <>
                <Link className="btn primary block" to={`/login?next=${encodeURIComponent(here)}`}>
                  ログインして参加する
                </Link>
                <Link className="btn glassy block" to={`/signup?next=${encodeURIComponent(here)}`}>
                  アカウントを作って参加する
                </Link>
              </>
            )}
          </>
        )}
      </section>
    </AuthShell>
  );
}
