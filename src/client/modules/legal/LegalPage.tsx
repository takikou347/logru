import { marked } from "marked";
import { useEffect, useMemo } from "react";
import privacy from "../../../../legal/privacy.md?raw";
import terms from "../../../../legal/terms.md?raw";
import { BackLink } from "@/components/parts/BackLink";
import { Pools } from "@/components/parts/Pools";

const DOCS = { terms, privacy } as const;
const TITLES = { terms: "利用規約", privacy: "プライバシーポリシー" } as const;

/**
 * 利用規約とプライバシーポリシーの画面。ログインしていなくても見られる。F-16
 * 本文は `legal/` の Markdown。このリポジトリで書いたものだけなので、HTML にしてそのまま出す。
 */
export function LegalPage({ doc }: { doc: keyof typeof DOCS }) {
  const html = useMemo(() => marked.parse(DOCS[doc], { async: false }), [doc]);
  useEffect(() => {
    document.title = `${TITLES[doc]} | Logru`;
    return () => {
      document.title = "Logru";
    };
  }, [doc]);
  return (
    <main className="px-4 pt-[max(24px,env(safe-area-inset-top))] pb-16">
      <Pools colors={["wakatake", "yamabuki", "asagi"]} />
      <article className="glass legal-body mx-auto max-w-[720px] rounded-panel px-5 py-6 lg:px-10 lg:py-9">
        <div className="mb-2">
          <BackLink to="/">Logru に戻る</BackLink>
        </div>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
