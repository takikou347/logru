import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { ApiError } from "../lib/api";
import { useMe } from "../lib/queries";
import { applyTheme } from "../lib/theme";

/** ログインしていなければログイン画面へ。同意が要れば同意の画面へ */
export function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  const here = location.pathname + location.search;

  useEffect(() => {
    if (me.data) applyTheme(me.data.settings.themeMode, me.data.settings.accentColor);
  }, [me.data]);

  if (me.isPending) return <div className="loading">読み込んでいます</div>;
  if (me.error) {
    if (me.error instanceof ApiError && me.error.status === 401) {
      return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />;
    }
    return (
      <div className="loading">
        <div className="stack" style={{ alignItems: "center" }}>
          <p>{me.error.message}</p>
          <button className="btn glassy" type="button" onClick={() => me.refetch()}>
            もう一度読み込む
          </button>
        </div>
      </div>
    );
  }
  if (me.data.needsAgreement.length > 0 && location.pathname !== "/agree") {
    return <Navigate to={`/agree?next=${encodeURIComponent(here)}`} replace />;
  }
  return <Outlet />;
}

/** ログイン済みなら、ログインや登録の画面を飛ばす */
export function GuestOnly() {
  const me = useMe();
  if (me.isPending) return <div className="loading">読み込んでいます</div>;
  if (me.data) return <Navigate to="/" replace />;
  return <Outlet />;
}
