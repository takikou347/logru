import { toast } from "sonner";
import { useResetTours } from "@/api/common";
import { Button } from "@/components/ui/button";

/**
 * 「画面の案内をもう一度出す」。見た画面の一覧を空にし、次に開いた画面でまた案内を出す。F-33
 * 設定の「使い方」の欄に置く。#72
 */
export function ResetToursButton() {
  const reset = useResetTours();
  return (
    <Button
      variant="secondary"
      className="self-start"
      disabled={reset.isPending}
      onClick={() => reset.mutate(undefined, { onSuccess: () => toast("次に開いた画面で、案内をもう一度出します") })}
    >
      画面の案内をもう一度出す
    </Button>
  );
}
