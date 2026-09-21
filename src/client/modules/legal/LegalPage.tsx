import { marked } from "marked";
import { useEffect, useMemo } from "react";
import privacy from "../../../../legal/privacy.md?raw";
import terms from "../../../../legal/terms.md?raw";
import { BackButton } from "@/components/BackButton";
import { Pools } from "@/components/Pools";

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
    <main className="px-4 pt-[max(16px,env(safe-area-inset-top))] pb-16">
      <Pools colors={["wakatake", "yamabuki", "asagi"]} />
      <div className="mx-auto mb-3 max-w-[720px]">
        <BackButton to="/" label="Logru に戻る" />
      </div>
      <article className="glass legal-body mx-auto max-w-[720px] rounded-panel px-5 py-6 lg:px-10 lg:py-9">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </main>
  );
}
