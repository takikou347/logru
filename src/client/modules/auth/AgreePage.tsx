import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthCard, AuthShell, AuthText, AuthTitle, Notice } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { keys } from "@/lib/queries";
import { safeNext } from "@/lib/utils";

/** 最新の規約に同意したことを送る。登録の画面で受けた同意を送るときにも使う */
export function postAgreement(): Promise<void> {
  return api("/me/agreements", { method: "POST", body: { agreed: true } });
}

/**
 * 規約への同意の画面。F-16
 * Google で登録した直後と、規約を改めた後の最初のログインで出す。
 */
export function AgreePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await postAgreement();
      await qc.invalidateQueries({ queryKey: keys.me });
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
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
