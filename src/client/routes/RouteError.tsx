import { isRouteErrorResponse, useRouteError } from "react-router";
import { AuthShell } from "./AuthShell";

/** 画面の読み込みで失敗したとき。新しい版を公開した直後に、古いファイルを読みにいくと起きる */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <AuthShell>
      <section className="card glass" role="alert">
        <h1>{notFound ? "ページが見つかりません" : "画面を開けませんでした"}</h1>
        <p>
          {notFound
            ? "アドレスが間違っているか、ページが消えています。"
            : "新しい版に切り替わったか、通信が切れた可能性があります。読み込み直してください。"}
        </p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          読み込み直す
        </button>
      </section>
    </AuthShell>
  );
}
