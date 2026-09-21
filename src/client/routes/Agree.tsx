import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { api } from "../lib/api";
import { keys } from "../lib/queries";
import { AuthShell, safeNext } from "./AuthShell";

/** 規約を改めた後や、Google で登録した直後に、同意を取る */
export function Agree() {
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
      await api("/me/agreements", { method: "POST", body: { agreed: true } });
      await qc.invalidateQueries({ queryKey: keys.me });
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <section className="card glass">
        <h1>規約への同意</h1>
        <p>Logru を使う前に、利用規約とプライバシーポリシーを読んで、同意してください。</p>
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
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
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="button" disabled={!agreed || busy} onClick={submit}>
          同意して始める
        </button>
      </section>
    </AuthShell>
  );
}
