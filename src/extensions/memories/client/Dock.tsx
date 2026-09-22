import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 画面の主な操作を置く帯。スマホは下に浮かべ、PC は中身の上に並べる。0024
 * @param label 読み上げでの名前
 */
export function Dock({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "glass fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[528px] items-center gap-1.5 rounded-full p-1.5",
        "lg:static lg:mx-0 lg:max-w-none lg:justify-end lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:before:hidden",
        "[&>*]:flex-1 lg:[&>*]:flex-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
