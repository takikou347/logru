import { ChevronDown, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useMe } from "@/api/common";
import { signOut } from "@/app/auth";
import { UserAvatar } from "@/components/parts/Avatars";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBack } from "@/lib/use-back";
import { cn } from "@/lib/utils";

/** ログアウトして、ログインの画面へ移る関数を返す */
export function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
}

/** メニューの 1 行の見た目。AppShell の左の列と、その中の絞り込みで共通に使う。0071 */
export const navItem =
  "flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-medium no-underline aria-[current=page]:bg-field aria-pressed:bg-field";

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
 * @param back 前の画面の記録が無いときに移る、決まった先。渡すと PC でも戻るボタンを出す。一覧の下の画面で使う。
 *   渡さなければスマホだけに出し、既定はカレンダー。押したときの行き先は、記録があれば前の画面を優先する。0070
 * @param backMobileOnly back を渡しつつ、PC では隠す。PC に別の道順(設定の目次など)が既にある画面で使う
 * @param onTitleClick 渡すと見出しがボタンになる。拡張の画面どうしの行き来を近くするため、
 *   機能のシートを開くのに使う。スマホで下の帯が無い画面(設定など)でも同じ道が開ける。issue #26
 * @param action 見出しの右に置く、その画面だけの操作。1 つだけ。下の帯の「+」とは別の、頻度の低い操作に使う。issue #150
 */
export function PageBar({
  title,
  back,
  backMobileOnly,
  onTitleClick,
  action,
}: {
  title: string;
  back?: string;
  backMobileOnly?: boolean;
  onTitleClick?: () => void;
  action?: ReactNode;
}) {
  const hideOnDesktop = !back || backMobileOnly;
  const titleClass = cn("min-w-0 flex-1 truncate pl-2 text-[17px] font-bold", hideOnDesktop && "lg:pl-3");
  const goBack = useBack(back ?? "/");
  return (
    <header className="glass flex min-h-[58px] items-center gap-1 rounded-full py-1.5 pr-2.5 pl-1.5">
      <Button asChild variant="ghost" size="icon" className={cn(hideOnDesktop && "lg:hidden")}>
        <Link to={goBack.to} aria-label="戻る" onClick={goBack.onClick}>
          <ChevronLeft className="size-5" />
        </Link>
      </Button>
      {onTitleClick ? (
        <h1 className={titleClass}>
          <button type="button" className="flex items-center gap-1" onClick={onTitleClick}>
            {title}
            <ChevronDown className="size-4 text-ink-2" aria-hidden="true" />
            <span className="sr-only">。押すと機能の一覧が開きます</span>
          </button>
        </h1>
      ) : (
        <h1 className={titleClass}>{title}</h1>
      )}
      {action}
    </header>
  );
}

/** 設定やグループの画面の中身。PC では幅を絞る */
export function Page({ children }: { children: ReactNode }) {
  return <div className="flex w-full max-w-[640px] flex-col gap-3">{children}</div>;
}
