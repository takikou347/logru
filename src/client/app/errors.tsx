import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { AuthCard, AuthShell, AuthText, AuthTitle } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";

/**
 * 画面を開けなかったとき。新しい版を公開した直後に、古いファイルを読みにいくと起きる。
 * 読み込み直せば、新しい版で開き直せる。
 */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  return (
    <AuthShell>
      <AuthCard role="alert">
        <AuthTitle>画面を開けませんでした</AuthTitle>
        <AuthText>新しい版に切り替わったか、通信が切れた可能性があります。読み込み直してください。</AuthText>
        <Button onClick={() => window.location.reload()}>読み込み直す</Button>
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
        <AuthText>アドレスが間違っているか、ページが消えています。</AuthText>
        <Button asChild>
          <Link to="/">カレンダーへ</Link>
        </Button>
      </AuthCard>
    </AuthShell>
  );
}
