/**
 * 空の画面の共通部品。マスコットの小さな絵、文、次にすることのボタンを 1 つ出す。F-12、0053
 *
 * 絵は飾りなので読み上げでは読ませない(`aria-hidden`)。読み上げは文とボタンだけに聞こえる。
 * カレンダーや家計簿など、複数の画面がこの 1 つを使い回す。
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mascot, type MascotPose } from "./Mascot";

type Action = {
  label: string;
  /** 別の画面へ移るときはこちら。シートを閉じる、その場で足すときは onClick */
  to?: string;
  onClick?: () => void;
  variant?: "default" | "secondary";
};

export function EmptyState({
  pose,
  children,
  action,
  bordered = true,
  className,
}: {
  pose: MascotPose;
  children: ReactNode;
  action: Action;
  /** ダイアログやシートの中など、すでに囲みがある場所では false にして二重の枠を避ける */
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-5 text-center",
        bordered && "rounded-2xl border-[1.5px] border-dashed border-line px-5",
        className,
      )}
    >
      <Mascot pose={pose} />
      <p className="text-sm leading-relaxed text-ink-2">{children}</p>
      <Button variant={action.variant ?? "secondary"} size="sm" asChild={!!action.to} onClick={action.onClick}>
        {action.to ? <Link to={action.to}>{action.label}</Link> : action.label}
      </Button>
    </div>
  );
}
