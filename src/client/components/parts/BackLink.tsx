import type { ReactNode } from "react";
import { Link } from "react-router";

type Props = { children: ReactNode } & ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

const look =
  "-ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-1 text-[13px] text-ink-2 no-underline! hover:text-ink";

/**
 * カードの左上に置く、戻るためのリンク。見出しの上に小さく出す。押せる高さは 44px。
 * 行き先へ移るだけなら to、ログアウトしてから移るときなどは onClick を渡す。
 */
export function BackLink({ children, to, onClick }: Props) {
  const body = (
    <>
      <span aria-hidden="true">‹</span>
      {children}
    </>
  );
  if (to !== undefined) {
    return (
      <Link className={look} to={to}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" className={look} onClick={onClick}>
      {body}
    </button>
  );
}
