import { CalendarDays, ChevronLeft, SlidersHorizontal, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { useMe } from "@/api/common";
import { signOut } from "@/app/auth";
import { UserAvatar } from "@/components/parts/Avatars";
import { OfflineBand } from "@/components/parts/Failure";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEnabledExtensions } from "@/lib/extensions";
import { useApplyLabExperiments } from "@/lib/lab";
import { cn } from "@/lib/utils";
import { Pools } from "../parts/Pools";
import { ShortcutBand } from "../parts/ShortcutBand";
import { ScrollArea } from "../ui/scroll-area";

/** ログアウトして、ログインの画面へ移る関数を返す */
export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
}

const navItem =
  "flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium no-underline aria-[current=page]:bg-field aria-pressed:bg-field";

/**
 * ログインした後の枠。スマホは縦に積み、1024px 以上は左にメニューの列を置く。
 *
 * @param poolColors インクだまりの 3 色
 * @param poolFocus 膨らませる色の番号
 * @param side PC の左の列に足すもの。カレンダーはグループの絞り込みを置く。多いときは、この欄だけが流れる。F-25
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
  const navs = useEnabledExtensions().flatMap((x) => (x.nav ? [x.nav] : []));
  // ログインした画面はすべてこの枠を通るので、ここで 1 か所、ラボの入り切りを掛け直す。0039、F-35
  const me = useMe();
  useApplyLabExperiments(me.data?.showLab);
  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh max-w-[560px] flex-col gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[var(--dock-clearance)]",
        "lg:m-0 lg:grid lg:max-w-none lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-4 lg:p-4",
      )}
    >
      <Pools colors={poolColors} focus={poolFocus} />
      <aside
        className="glass sticky top-4 hidden h-[calc(100dvh-32px)] flex-col gap-3 rounded-panel px-3.5 py-5.5 lg:flex"
        aria-label="メニュー"
      >
        <div className="pl-2 text-[32px] leading-none font-extrabold tracking-[-0.03em]">Logru</div>
        <nav aria-label="画面">
          <NavLink className={navItem} to="/" end>
            <CalendarDays className="size-4" aria-hidden="true" />
            カレンダー
          </NavLink>
          {navs.slice(0, 6).map((n) => (
            <NavLink key={n.path} className={navItem} to={n.path}>
              <n.icon className="size-4" aria-hidden="true" />
              {n.label}
            </NavLink>
          ))}
          <NavLink className={navItem} to="/groups">
            <Users className="size-4" aria-hidden="true" />
            グループ
          </NavLink>
          <NavLink className={cn(navItem, "min-h-9 text-xs text-ink-2")} to="/settings/extensions">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            機能を足す、外す
          </NavLink>
        </nav>
        <ShortcutBand compact />
        {side ? <ScrollArea className="min-h-0 flex-1 -mr-1.5">{side}</ScrollArea> : <div className="flex-1" />}
        <div className="border-t border-line pt-2">
          <AccountMenu wide />
        </div>
      </aside>
      {/*
        オフラインの帯は、中身の最初にある上の帯のすぐ下に並べる。0025
        ほかの中身は order を 0 のままにする。display: contents の孫も 0 で並ぶため
      */}
      <div className="flex min-w-0 flex-col gap-3 *:first:-order-2">
        {children}
        <OfflineBand className="-order-1" />
      </div>
    </main>
  );
}

/** PC の左の列の見出し */
export function SideHeading({ children }: { children: ReactNode }) {
  return <h2 className="px-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-ink-2">{children}</h2>;
}

/** PC の左の列の 1 行の見た目。絞り込みのボタンに使う */
export const sideItemClass = navItem;

/**
 * 利用者のアイコンと、押すと開くメニュー。名前とメールアドレス、設定、ログアウトを並べる。
 * PC は左の列の下に置き、スマホは上の帯の右端に置く。
 * アイコンは、アカウントのメニュー、PC の左の列、予定の参加者、グループのメンバーの行と同じ部品。#40
 *
 * @param wide PC の左の列の形。アイコンの横に名前を出し、メニューは上に開く
 */
export function AccountMenu({ wide = false }: { wide?: boolean }) {
  const me = useMe();
  const doSignOut = useSignOut();
  // ログイン済みの画面はこの枠を通る前に me を読み終えている。app/guards.tsx
  if (!me.data) return null;
  const { name, email } = me.data.user;
  const avatar = <UserAvatar userId={me.data.user.id} me={me.data} size={34} />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {wide ? (
          <button type="button" className={cn(navItem, "min-h-12 px-2")} aria-label="アカウントのメニュー">
            {avatar}
            <span className="min-w-0 flex-1 truncate">{name}</span>
          </button>
        ) : (
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="アカウントのメニュー">
            {avatar}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={wide ? "top" : "bottom"}
        align={wide ? "start" : "end"}
        sideOffset={8}
        className="w-72 max-w-[calc(100vw-32px)]"
      >
        <DropdownMenuLabel className="flex items-center gap-2.5">
          {avatar}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold">{name}</span>
            <span className="truncate text-[13px] font-normal text-ink-2">{email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!wide && (
          <DropdownMenuItem asChild>
            <Link to="/groups">グループ</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/settings">設定</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={doSignOut}>ログアウト</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 設定やグループの画面の上の帯。左に戻るボタンを置く。
 * @param back 戻る先。渡すと PC でも戻るボタンを出す。一覧の下の画面で使う。渡さなければスマホだけに出し、カレンダーへ戻る
 * @param backMobileOnly back を渡しつつ、PC では隠す。PC に別の道順(設定の目次など)が既にある画面で使う
 * @param action 見出しの右に置く、その画面だけの操作。1 つだけ。下の帯の「+」とは別の、頻度の低い操作に使う。issue #150
 */
export function PageBar({
  title,
  back,
  backMobileOnly,
  action,
}: {
  title: string;
  back?: string;
  backMobileOnly?: boolean;
  action?: ReactNode;
}) {
  const hideOnDesktop = !back || backMobileOnly;
  return (
    <header className="glass flex min-h-[58px] items-center gap-1 rounded-full py-1.5 pr-2.5 pl-1.5">
      <Button asChild variant="ghost" size="icon" className={cn(hideOnDesktop && "lg:hidden")}>
        <Link to={back ?? "/"} aria-label="戻る">
          <ChevronLeft className="size-5" />
        </Link>
      </Button>
      <h1 className={cn("min-w-0 flex-1 truncate pl-2 text-[17px] font-bold", hideOnDesktop && "lg:pl-3")}>{title}</h1>
      {action}
    </header>
  );
}

/** 設定やグループの画面の中身。PC では幅を絞る */
export function Page({ children }: { children: ReactNode }) {
  return <div className="flex w-full max-w-[640px] flex-col gap-3">{children}</div>;
}
