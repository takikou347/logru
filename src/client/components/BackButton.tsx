import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { label: string; className?: string } & ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

/**
 * 左上に置く、丸いガラスの戻るボタン。押せる範囲は 44px。
 * 文字は出さないので、label で何をするかを読み上げに伝える。
 * 行き先へ移るだけなら to、ログアウトしてから移るときなどは onClick を渡す。
 */
export function BackButton({ label, className, to, onClick }: Props) {
  const look = cn("glass", className);
  if (to !== undefined) {
    return (
      <Button asChild variant="ghost" size="icon" className={look}>
        <Link to={to} aria-label={label}>
          ‹
        </Link>
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="icon" className={look} aria-label={label} onClick={onClick}>
      ‹
    </Button>
  );
}
