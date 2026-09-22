import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { Pools } from "../parts/Pools";

/** ログインまわりの画面の枠。インクだまりと名前を出し、下に規約へのリンクを置く */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 pt-[max(72px,env(safe-area-inset-top))] pb-10">
      <Pools colors={["wakatake", "yamabuki", "asagi"]} />
      <div className="mb-7 text-center text-[56px] leading-none font-extrabold tracking-[-0.03em]">Logru</div>
      <div className="w-full max-w-[420px]">{children}</div>
      <p className="mt-4.5 text-center text-xs leading-loose text-ink-2">
        <Link to="/terms">利用規約</Link> ・ <Link to="/privacy">プライバシーポリシー</Link>
      </p>
    </main>
  );
}

/** ログインまわりの画面の中の、ガラスの面 */
export function AuthCard({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("glass flex flex-col gap-3.5 rounded-panel px-4.5 py-5.5", className)} {...props} />;
}

/** 面の見出し */
export function AuthTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[19px] font-bold">{children}</h1>;
}

/** 面の本文 */
export function AuthText({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm leading-7", className)} {...props} />;
}

/** 目立たせる知らせ。error なら朱の枠にする */
export function Notice({ error, className, ...props }: ComponentProps<"p"> & { error?: boolean }) {
  return (
    <p
      role={error ? "alert" : undefined}
      className={cn(
        "rounded-2xl border border-line bg-field px-3.5 py-3 text-[13px] leading-relaxed",
        error && "border-sun text-sun",
        className,
      )}
      {...props}
    />
  );
}

/** 「または」の区切り */
export function OrDivider({ children = "または" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-ink-2 before:h-px before:flex-1 before:bg-line before:content-[''] after:h-px after:flex-1 after:bg-line after:content-['']">
      {children}
    </div>
  );
}

/**
 * Google のボタン。Google のブランドの決まりに合わせ、白地に色付きの G を置く。ダークでは黒地にする。
 */
export function GoogleButton({ children, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-[#747775] bg-white text-[15px] font-medium text-[#1f1f1f] dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3]"
      {...props}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
      {children}
    </button>
  );
}
