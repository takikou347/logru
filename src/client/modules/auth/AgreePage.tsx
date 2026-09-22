import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthCard, AuthShell, AuthText, AuthTitle, Notice } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { safeNext } from "@/lib/utils";
import { useAgreeToLegal } from "./api";

export { postAgreement } from "./api";

/**
 * 規約への同意の画面。F-16
 * Google で登録した直後と、規約を改めた後の最初のログインで出す。
 */
export function AgreePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const agree = useAgreeToLegal();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = agree.isPending;

  async function submit() {
    setError(null);
    try {
      await agree.mutateAsync();
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <AuthShell>
      <AuthCard>
        <AuthTitle>規約への同意</AuthTitle>
        <AuthText>Logru を使う前に、利用規約とプライバシーポリシーを読んで、同意してください。</AuthText>
        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
          <Checkbox className="mt-0.5 size-5" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} aria-label="利用規約とプライバシーポリシーに同意する" />
          <span>
            <Link to="/terms" target="_blank">
              利用規約
            </Link>
            と
            <Link to="/privacy" target="_blank">
              プライバシーポリシー
            </Link>
            に同意する
          </span>
        </label>
        {error && <Notice error>{error}</Notice>}
        <Button disabled={!agreed || busy} onClick={submit}>
          同意して始める
        </Button>
      </AuthCard>
    </AuthShell>
  );
}
