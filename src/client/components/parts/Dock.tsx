import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 画面の主な「足す」ボタンを置く帯。スマホは右下に浮かべ、PC は中身の末尾に並べる。0024、0062
 * カレンダー、思い出、家計簿、共有リストで共通に使う。左側の他の操作(月・週・日の切り替えなど)は
 * それぞれの画面が自分で組む。ここは主な操作(PrimaryAddButton)だけを包む。
 * @param label 読み上げでの名前
 */
export function Dock({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "glass fixed right-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-20 flex items-center gap-1.5 rounded-full p-1.5",
        "lg:static lg:justify-end lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:before:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
