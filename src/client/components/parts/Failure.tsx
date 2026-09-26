import type { ReactNode } from "react";
import { useOnline } from "@/lib/online";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Mascot } from "./Mascot";

/**
 * 面の中で出す失敗。「見つかりません」と「読み込めませんでした」に使う。0025
 *
 * 画面全体は替えず、失敗した面だけをこれにする。上の帯や左の列は残す。
 *
 * @param mark 見つからないなら `?`、読み込めないなら `!`。`!` のときは読み上げで知らせる(role="alert")
 * @param action 次の一手のボタンやリンク
 */
export function FailurePanel({
  title,
  children,
  mark = "!",
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  mark?: "!" | "?";
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      role={mark === "!" ? "alert" : undefined}
      className={cn(
        "glass flex min-h-[320px] flex-col items-center justify-center gap-3.5 rounded-panel px-5.5 py-7 text-center",
        className,
      )}
    >
      {/* しょんぼりしたメクリ。見つからないときも、読み込めないときも同じ絵。0053、#179 */}
      <Mascot pose="sad" />

      <h2 className="text-base font-bold">{title}</h2>
      {children && <p className="text-[13px] leading-[1.8] text-ink-2">{children}</p>}
      {action}
    </section>
  );
}

/**
 * 読み込めなかった面。押すと読み直す。
 * @param what 何を読めなかったか。例は「9 月の予定」
 * @param error 失敗。文をそのまま出す
 */
export function LoadFailure({
  what,
  error,
  onRetry,
  className,
}: {
  what: string;
  error: Error;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <FailurePanel
      title={`${what}を読み込めませんでした`}
      className={className}
      action={
        <Button variant="secondary" onClick={onRetry}>
          もう一度読み込む
        </Button>
      }
    >
      {error.message}
    </FailurePanel>
  );
}

/**
 * 通信が切れているときだけ出す、細い帯。前に読んだ内容を出していることを伝える。0025
 *
 * ログインした後の枠が、上の帯のすぐ下に置く。
 */
export function OfflineBand({ className }: { className?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className={cn(
        "glass flex min-h-9 items-center gap-2.5 rounded-full px-4 text-[12.5px] font-medium text-ink-2",
        className,
      )}
    >
      <span className="size-2.5 flex-none rounded-full border-2 border-ink-2" aria-hidden="true" />
      オフライン。前に読んだ内容を出しています
    </div>
  );
}
