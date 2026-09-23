import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ボタンの見た目。shadcn/ui の Button を、Logru の見た目に合わせる。0010
 * 高さは 48px、押せる範囲は 44px 以上。0012
 */
const buttonVariants = cva(
  // 押している間だけ 0.97 倍。0044、0048、#98
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-[transform,opacity,background-color] duration-fast ease-in-out outline-none active:not-disabled:scale-97 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** 主ボタン。テーマカラー */
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_8px_18px_-8px_rgba(0,0,0,.5)] hover:bg-primary/90",
        /** ガラスのボタン。主ではない操作 */
        secondary: "border border-(--glass-edge) bg-field text-ink hover:bg-field-strong",
        /** 目立たせない操作。やめる、など */
        ghost: "text-ink-2 hover:bg-field",
        /** 消す操作の文字。確認の画面を開く前のボタンに使う */
        danger: "text-sun hover:bg-field",
        /** 消す操作の主ボタン */
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-ink underline underline-offset-4",
      },
      size: {
        default: "min-h-12 px-5 text-[15px]",
        sm: "min-h-10 px-3 text-[13px]",
        icon: "size-11 text-[22px] font-normal text-ink-2 hover:bg-field",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

/**
 * ボタン。asChild を付けると、子の要素をボタンの見た目にする。リンクをボタンにするときに使う。
 * @example <Button asChild><Link to="/">カレンダーへ</Link></Button>
 */
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), asChild && "no-underline", className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
