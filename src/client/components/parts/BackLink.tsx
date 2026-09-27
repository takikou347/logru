import type { ReactNode } from "react";
import { Link } from "react-router";
import { useBack } from "@/lib/use-back";

type Props = { children: ReactNode } & ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

const look =
  "-ml-1 inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-1 text-[13px] text-ink-2 no-underline! hover:text-ink";

/**
 * カードの左上に置く、戻るためのリンク。見出しの上に小さく出す。押せる高さは 44px。
 * to は前の画面の記録が無いときに移る決まった先。記録があれば、押したときにそちらへ戻る。0070
 * ログアウトしてから移るときなど、行き先を自分で決めたいときは onClick を渡す(この道は決まった先の記録をしない)。
 */
export function BackLink({ children, to, onClick }: Props) {
  const goBack = useBack(to ?? "/");
  const body = (
    <>
      <span aria-hidden="true">‹</span>
      {children}
    </>
  );
  if (to !== undefined) {
    return (
      <Link className={look} to={goBack.to} onClick={goBack.onClick}>
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
