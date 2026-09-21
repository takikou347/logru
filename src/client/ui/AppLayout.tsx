import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { clearApiCache } from "../lib/api";
import { authClient } from "../lib/auth-client";
import { useMe } from "../lib/queries";
import { Pools } from "./Pools";
import { Sheet } from "./Sheet";

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await authClient.signOut();
    await clearApiCache();
    qc.clear();
    navigate("/login", { replace: true });
  };
}

/** ログインした後の枠。PC では左にメニューを置く */
export function AppLayout({
  children,
  poolColors,
  poolFocus,
  side,
}: {
  children: ReactNode;
  poolColors: string[];
  poolFocus?: number | null;
  side?: ReactNode;
}) {
  const me = useMe();
  const signOut = useSignOut();
  const name = me.data?.user.name ?? "";
  return (
    <div className="app">
      <Pools colors={poolColors} focus={poolFocus} />
      <aside className="side glass" aria-label="メニュー">
        <div className="word">Logru</div>
        <nav>
          <NavLink className="navitem" to="/" end>
            カレンダー
          </NavLink>
          <NavLink className="navitem" to="/groups">
            グループ
          </NavLink>
          <NavLink className="navitem" to="/settings">
            設定
          </NavLink>
        </nav>
        {side}
        <div className="me">
          <span className={`avatar c-${me.data?.settings.userColor ?? "wakatake"}`} aria-hidden="true">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          <button className="btn ghost" type="button" onClick={signOut} style={{ minHeight: 40, padding: "0 10px", fontSize: 13 }}>
            ログアウト
          </button>
        </div>
      </aside>
      <div className="app-main">{children}</div>
    </div>
  );
}

/** スマホのメニュー */
export function MenuButton() {
  const [open, setOpen] = useState(false);
  const signOut = useSignOut();
  return (
    <>
      <button className="icon-btn mobile-only" type="button" aria-label="メニューを開く" onClick={() => setOpen(true)}>
        ☰
      </button>
      {open && (
        <Sheet title="メニュー" onClose={() => setOpen(false)}>
          <nav className="menu-list">
            <Link to="/groups">グループ</Link>
            <Link to="/settings">設定</Link>
            <button type="button" onClick={signOut}>
              ログアウト
            </button>
          </nav>
        </Sheet>
      )}
    </>
  );
}

/** 設定やグループの画面の上の帯。スマホでは戻るボタンを出す */
export function PageBar({ title, back = "/" }: { title: string; back?: string }) {
  return (
    <header className="pagebar glass">
      <Link className="icon-btn mobile-only" to={back} aria-label="戻る">
        ‹
      </Link>
      <h1>{title}</h1>
    </header>
  );
}
