import { Link } from "react-router";
import { AuthShell } from "./AuthShell";

export function NotFound() {
  return (
    <AuthShell>
      <section className="card glass">
        <h1>ページが見つかりません</h1>
        <p>アドレスが間違っているか、ページが消えています。</p>
        <Link className="btn primary" to="/">
          カレンダーへ
        </Link>
      </section>
    </AuthShell>
  );
}
