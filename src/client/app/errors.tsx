import { useEffect } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { AuthCard, AuthShell, AuthText, AuthTitle } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { clientErrorReporter, describeError } from "@/lib/error-report";

/**
 * 画面を開けなかったとき。新しい版を公開した直後に、古いファイルを読みにいくと起きる。
 * 読み込み直せば、新しい版で開き直せる。古いファイルのときは main.tsx が 1 度だけ黙って読み込み直し、
 * それでも開けなければここに来る。0025
 *
 * カレンダーへは、アプリを読み込み直して移る。壊れた画面の状態を持ち越さない。
 * 無いページ(404)を除き、起きた誤りをサーバーへ送る。0040
 */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  useEffect(() => {
    if (notFound) return;
    const { message, stack } = describeError(error);
    clientErrorReporter.report(message, stack);
  }, [error, notFound]);
  if (notFound) return <NotFound />;
  return (
    <AuthShell>
      <AuthCard role="alert">
        <AuthTitle>画面を開けませんでした</AuthTitle>
        <AuthText>読み込み直すと、たいていは開けます。</AuthText>
        <Button onClick={() => window.location.reload()}>読み込み直す</Button>
        <Button asChild variant="ghost">
          <a href="/">カレンダーへ</a>
        </Button>
      </AuthCard>
    </AuthShell>
  );
}

/** 無いページを開いたとき */
export function NotFound() {
  return (
    <AuthShell>
      <AuthCard>
        <AuthTitle>ページが見つかりません</AuthTitle>
        <AuthText>アドレスが違うか、ページが消えています。</AuthText>
        <Button asChild>
          <Link to="/">カレンダーへ</Link>
        </Button>
      </AuthCard>
    </AuthShell>
  );
}
