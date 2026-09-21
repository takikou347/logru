import { Menu } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { signOut } from "@/app/auth";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Pools } from "./Pools";
import { ResponsiveSheet } from "./ResponsiveSheet";

/** ログアウトして、ログインの画面へ移る関数を返す */
export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
}

const navItem = "flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium no-underline aria-[current=page]:bg-field aria-pressed:bg-field";

/**
 * ログインした後の枠。スマホは縦に積み、1024px 以上は左にメニューの列を置く。
 *
 * @param poolColors インクだまりの 3 色
 * @param poolFocus 膨らませる色の番号
 * @param side PC の左の列に足すもの。カレンダーはグループの絞り込みを置く
 */
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
  const doSignOut = useSignOut();
  const name = me.data?.user.name ?? "";
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh max-w-[560px] flex-col gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(120px+env(safe-area-inset-bottom))]",
        "lg:m-0 lg:grid lg:max-w-none lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-4 lg:p-4",
      )}
    >
      <Pools colors={poolColors} focus={poolFocus} />
      <aside className="glass sticky top-4 hidden h-[calc(100dvh-32px)] flex-col gap-4.5 rounded-panel px-3.5 py-5.5 lg:flex" aria-label="メニュー">
        <div className="pl-2 text-[32px] leading-none font-extrabold tracking-[-0.03em]">Logru</div>
        <nav>
          <NavLink className={navItem} to="/" end>
            カレンダー
          </NavLink>
          <NavLink className={navItem} to="/groups">
            グループ
          </NavLink>
          <NavLink className={navItem} to="/settings">
            設定
          </NavLink>
        </nav>
        {side}
        <div className="mt-auto flex items-center gap-2.5 px-2 text-sm">
          <span
            className={cn("grid size-[34px] flex-none place-items-center rounded-full bg-(--c) font-bold text-white", `c-${me.data?.settings.userColor ?? "wakatake"}`)}
            aria-hidden="true"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <Button variant="ghost" size="sm" onClick={doSignOut}>
            ログアウト
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </div>
  );
}

/** PC の左の列の見出し */
export function SideHeading({ children }: { children: ReactNode }) {
  return <h2 className="px-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-ink-2">{children}</h2>;
}

/** PC の左の列の 1 行の見た目。絞り込みのボタンに使う */
export const sideItemClass = navItem;

/** スマホのメニュー。上の帯の右に置く */
export function MenuButton() {
  const [open, setOpen] = useState(false);
  const doSignOut = useSignOut();
  const item = "flex min-h-13 items-center border-b border-line text-base no-underline last:border-b-0";
  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="メニューを開く" onClick={() => setOpen(true)}>
        <Menu />
      </Button>
      {open && (
        <ResponsiveSheet title="メニュー" onClose={() => setOpen(false)}>
          <nav className="flex flex-col">
            <Link className={item} to="/groups">
              グループ
            </Link>
            <Link className={item} to="/settings">
              設定
            </Link>
            <button type="button" className={cn(item, "text-left")} onClick={doSignOut}>
              ログアウト
            </button>
          </nav>
        </ResponsiveSheet>
      )}
    </>
  );
}

/**
 * 設定やグループの画面の上の帯。スマホでは戻るボタンを出す。
 * @param back 戻る先。既定はカレンダー
 */
export function PageBar({ title, back = "/" }: { title: string; back?: string }) {
  return (
    <header className="glass flex min-h-[58px] items-center gap-1 rounded-full py-1.5 pr-4.5 pl-1.5">
      <Button asChild variant="ghost" size="icon" className="lg:hidden">
        <Link to={back} aria-label="戻る">
          ‹
        </Link>
      </Button>
      <h1 className="pl-2 text-[17px] font-bold lg:pl-3">{title}</h1>
    </header>
  );
}

/** 設定やグループの画面の中身。PC では幅を絞る */
export function Page({ children }: { children: ReactNode }) {
  return <div className="flex w-full max-w-[640px] flex-col gap-3">{children}</div>;
}
