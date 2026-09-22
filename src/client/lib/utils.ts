import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * クラス名をつなぎ、Tailwind の同じ種類の指定は後ろを勝たせる。shadcn/ui の部品が使う。
 * @example cn("px-4", isWide && "px-8") // => "px-8"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 外から渡された戻り先を、同じサイトの中のパスだけに絞る。
 * `//evil.example` のような別のサイトへの移動を防ぐ。
 * @param raw URL の `next` の値
 * @returns 使ってよいパス。だめなら `/`
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
