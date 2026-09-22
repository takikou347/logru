import { CircleCheckIcon, OctagonXIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * 知らせ。shadcn/ui の Sonner を、Logru の見た目に合わせる。
 * 明るさは html の data-theme に従うので、ここでは切り替えない。
 */
const Toaster = (props: ToasterProps) => (
  <Sonner
    position="bottom-center"
    offset={{ bottom: "calc(110px + env(safe-area-inset-bottom))" }}
    mobileOffset={{ bottom: "calc(110px + env(safe-area-inset-bottom))" }}
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4 text-(--wakatake)" />,
      error: <OctagonXIcon className="size-4" />,
    }}
    toastOptions={{
      /*
       * 色は種類ごとの欄だけで決める。toast の欄に色を書くと、同じ強さの指定が 2 つ並び、
       * どちらが勝つかは組み立てた CSS の並び順で決まる。前はここで種類の色が負けて、
       * ダークのときに白い面に白い文字が出ていた。
       */
      classNames: {
        toast: "!rounded-[26px] !border-0 !shadow-lg",
        default: "!bg-primary !text-primary-foreground",
        success: "!bg-primary !text-primary-foreground",
        info: "!bg-primary !text-primary-foreground",
        loading: "!bg-primary !text-primary-foreground",
        warning: "!bg-primary !text-primary-foreground",
        error: "!bg-destructive !text-destructive-foreground",
        actionButton: "!bg-transparent !font-bold !underline !underline-offset-3 !text-inherit",
      },
    }}
    style={{ "--width": "min(420px, calc(100vw - 32px))" } as CSSProperties}
    {...props}
  />
);

export { Toaster };
