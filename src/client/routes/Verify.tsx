import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AuthShell, safeNext } from "./AuthShell";

/** 確認メールのリンクから戻ってくる画面。成功すればそのままログインしている */
export function Verify() {
  const [params] = useSearchParams();
  const error = params.get("error");
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (error) return;
    void qc.invalidateQueries().then(() => navigate(safeNext(params.get("next")), { replace: true }));
  }, [error, navigate, params, qc]);

  if (!error) return <div className="loading">確かめています</div>;
  return (
    <AuthShell>
      <section className="card glass">
        <h1>リンクを確かめられませんでした</h1>
        <p>リンクの期限が切れているか、すでに使われています。ログインの画面から、もう一度確認メールを送ってください。</p>
        <Link className="btn primary" to="/login">
          ログインの画面へ
        </Link>
      </section>
    </AuthShell>
  );
}
