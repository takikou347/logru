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
      classNames: {
        toast: "!rounded-full !border-0 !bg-primary !text-primary-foreground !shadow-lg",
        error: "!bg-destructive !text-white",
        actionButton: "!bg-transparent !font-bold !underline !underline-offset-3 !text-inherit",
      },
    }}
    style={{ "--width": "min(420px, calc(100vw - 32px))" } as CSSProperties}
    {...props}
  />
);

export { Toaster };
