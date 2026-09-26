import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import { useMe } from "@/api/common";
import { keys } from "@/api/keys";
import { LoadFailure } from "@/components/parts/Failure";
import { applyTheme } from "@/lib/theme";
import { safeNext } from "@/lib/utils";
import { postAgreement } from "@/modules/auth/AgreePage";
import { takeRememberedAgreement } from "@/modules/auth/pending-agreement";
import { CalendarSkeleton } from "@/modules/calendar/components/CalendarSkeleton";
import { needsEmailVerification, useAuth } from "./auth";

/** 読み込み中の画面。中身が出るまでの一瞬だけ出す */
export function Loading({ children = "読み込んでいます" }: { children?: string }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center text-sm text-ink-2" role="status">
      {children}
    </div>
  );
}

/**
 * 読み込み中の画面。行き先がカレンダー(既定の画面)のときは、文字の代わりにカレンダーの骨組みを出す。
 * それ以外の画面は、これまでどおりの文字のまま。0044、0048、#98
 */
function RouteLoading({ pathname }: { pathname: string }) {
  return pathname === "/" ? <CalendarSkeleton /> : <Loading />;
}

/**
 * ログインした人だけの画面の入口。次の順に確かめ、足りなければその画面へ移す。
 *
 * 1. Firebase にログインしているか。していなければログインの画面
 * 2. メールで登録した人が、メールアドレスを確かめたか。まだなら確かめる画面
 * 3. 最新の規約に同意したか。登録の画面で同意していればそれを送る。無ければ同意の画面
 *
 * 自分の設定を読んだら、明るさとテーマカラーを当てる。
 */
export function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  const here = location.pathname + location.search;
  const signedIn = ready && user !== null && !needsEmailVerification(user);
  const me = useMe(signedIn);
  const qc = useQueryClient();
  const [posting, setPosting] = useState(false);

  const needsAgreement = (me.data?.needsAgreement.length ?? 0) > 0;

  useEffect(() => {
    if (me.data) applyTheme(me.data.settings.themeMode, me.data.settings.bgTheme, me.data.settings.accentColor);
  }, [me.data]);

  // 登録の画面で受けた同意を送る。送れなければ同意の画面で聞き直す
  useEffect(() => {
    if (!needsAgreement || !takeRememberedAgreement(user?.email)) return;
    setPosting(true);
    postAgreement()
      .catch(() => undefined)
      .then(() => qc.invalidateQueries({ queryKey: keys.me }))
      .finally(() => setPosting(false));
  }, [needsAgreement, qc, user?.email]);

  if (!ready) return <RouteLoading pathname={location.pathname} />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />;
  if (needsEmailVerification(user)) return <Navigate to={`/verify-email?next=${encodeURIComponent(here)}`} replace />;
  if (me.isPending || posting) return <RouteLoading pathname={location.pathname} />;
  if (me.error) {
    const code = me.error instanceof ApiError ? me.error.code : undefined;
    if (code === "EMAIL_NOT_VERIFIED")
      return <Navigate to={`/verify-email?next=${encodeURIComponent(here)}`} replace />;
    return (
      <div className="mx-auto grid min-h-[60dvh] max-w-[560px] place-items-center px-4">
        <LoadFailure what="自分の情報" error={me.error} onRetry={() => void me.refetch()} className="w-full" />
      </div>
    );
  }
  if (needsAgreement && location.pathname !== "/agree") {
    return <Navigate to={`/agree?next=${encodeURIComponent(here)}`} replace />;
  }
  // 覚えていた同意を送り終えたら、同意の画面は飛ばす
  if (!needsAgreement && location.pathname === "/agree") {
    return <Navigate to={safeNext(new URLSearchParams(location.search).get("next"))} replace />;
  }
  return <Outlet />;
}

/**
 * ログインや登録の画面の入口。ログイン済みなら飛ばして、戻り先へ移す。
 * メールアドレスを確かめていない人は、ここに残す。登録の途中で画面が切り替わらないようにする。
 */
export function GuestOnly() {
  const { user, ready } = useAuth();
  const [params] = useSearchParams();
  if (!ready) return <Loading />;
  if (user && !needsEmailVerification(user)) return <Navigate to={safeNext(params.get("next"))} replace />;
  return <Outlet />;
}
