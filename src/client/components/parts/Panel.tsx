import type { AttendeeResponse } from "@shared/api-types";
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

/** 押せる行。右に「›」を出す。色の設定やグループの一覧に使う */
export function RowButton({ className, children, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0",
        className,
      )}
      {...props}
    >
      {children}
      <span className="text-lg text-ink-3" aria-hidden="true">
        ›
      </span>
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
