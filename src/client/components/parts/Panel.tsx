import type { AttendeeResponse } from "@shared/api-types";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * ガラスの面。設定やグループの画面で、見出しの付いたまとまりを作る。
 * 見出しがあれば、読み上げではその名前の区画になる。
 * @param title 小さい見出し。省くと見出しを出さない
 */
export function Panel({ title, className, children, ...props }: ComponentProps<"section"> & { title?: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={title && !props["aria-label"] ? id : undefined}
      className={cn("glass flex flex-col gap-2.5 rounded-3xl px-4 py-3.5", className)}
      {...props}
    >
      {title && (
        <h2 id={id} className="text-xs font-bold tracking-wider text-ink-2">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

/** 面の中の 1 行。左に項目、右に値 */
export function PanelRow({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 border-b border-line text-sm last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

/** 面の中の押せる行に共通の並び。ボタンだけでなく、行の形をしたリンクにも使う */
export const rowClass =
  "flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0";

/**
 * 押せる行の右に出す印。今までの見た目は文字の「›」だけ。新しい見た目・スマホでは、
 * A3 の見本にそろえて lucide の矢印アイコンにする。押せる行を作る場所(RowButton、行の形の
 * Link)はこれを共通で使う。決定 0067、issue #243
 */
export function RowChevron() {
  return (
    <>
      <span className="nl-hide text-lg text-ink-3" aria-hidden="true">
        ›
      </span>
      <ChevronRight className="nl-only size-4 flex-none text-ink-3" aria-hidden="true" />
    </>
  );
}

/**
 * 押せる行の左に置く、丸いアイコン。新しい見た目・スマホでだけ出す(nl-only)。A3 の見本にそろえる。issue #243
 * @param icon 省くと何も出さない。今までの見た目のまま変えない行(中身そのものを表す行など)に使う
 */
export function RowIcon({ icon: Icon }: { icon?: LucideIcon }) {
  if (!Icon) return null;
  return (
    <span
      className="nl-only size-9 flex-none items-center justify-center rounded-full bg-field text-ink-2"
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  );
}

/**
 * 押せる行。右に「›」を出す。色の設定やグループの一覧に使う
 * @param icon 渡すと、新しい見た目・スマホでだけ行の左に丸いアイコンを出す。issue #243
 */
export function RowButton({ className, icon, children, ...props }: ComponentProps<"button"> & { icon?: LucideIcon }) {
  return (
    <button type="button" className={cn(rowClass, className)} {...props}>
      <RowIcon icon={icon} />
      {children}
      <RowChevron />
    </button>
  );
}

/** 空の状態。何も無いことと、次にできることを伝える */
export function Empty({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border-[1.5px] border-dashed border-line p-5 text-center text-sm leading-7 text-ink-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 色の点。色の名前を渡す。色だけで見分けさせないよう、近くに名前を出すこと。0012
 * @param response 招待への自分の返事。返事待ちは塗らずに輪だけ、参加しないは薄くする。#28
 */
export function Dot({
  color,
  className,
  response,
}: {
  color: string;
  className?: string;
  response?: AttendeeResponse;
}) {
  return (
    <span
      className={cn(
        "swatch-dot inline-block size-2",
        `c-${color}`,
        response === "pending" && "bg-transparent! shadow-[inset_0_0_0_1.5px_var(--c)]",
        response === "declined" && "opacity-40",
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** 入力の下に出す文。error なら朱にする */
export function FieldMessage({ id, children, error }: { id?: string; children: ReactNode; error?: boolean }) {
  return (
    <p
      id={id}
      className={cn("text-xs leading-relaxed", error ? "text-sun" : "text-ink-2")}
      role={error ? "alert" : undefined}
    >
      {children}
    </p>
  );
}
