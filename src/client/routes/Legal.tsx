import { marked } from "marked";
import { useEffect, useMemo } from "react";
import { Link } from "react-router";
import privacy from "../../../legal/privacy.md?raw";
import terms from "../../../legal/terms.md?raw";
import { Pools } from "../ui/Pools";

const DOCS = { terms, privacy } as const;

export function Legal({ doc }: { doc: keyof typeof DOCS }) {
  // 本文はこのリポジトリで書いたものだけ。外からの文字列は入らない
  const html = useMemo(() => marked.parse(DOCS[doc], { async: false }), [doc]);
  useEffect(() => {
    document.title = doc === "terms" ? "利用規約 | Logru" : "プライバシーポリシー | Logru";
    return () => {
      document.title = "Logru";
    };
  }, [doc]);
  return (
    <main className="legal">
      <Pools colors={["wakatake", "yamabuki", "asagi"]} />
      <article className="glass">
        <Link className="back" to="/">
          ‹ Logru に戻る
        </Link>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
