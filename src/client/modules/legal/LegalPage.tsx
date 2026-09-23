import { marked } from "marked";
import { useEffect, useMemo } from "react";
import { BackLink } from "@/components/parts/BackLink";
import { Pools } from "@/components/parts/Pools";
import help from "../../../../legal/help.md?raw";
import privacy from "../../../../legal/privacy.md?raw";
import terms from "../../../../legal/terms.md?raw";

const DOCS = { terms, privacy, help } as const;
const TITLES = { terms: "利用規約", privacy: "プライバシーポリシー", help: "よくある質問" } as const;

/**
 * 利用規約、プライバシーポリシー、よくある質問の画面。ログインしていなくても見られる。F-16、F-32
 * 本文は `legal/` の Markdown。このリポジトリで書いたものだけなので、HTML にしてそのまま出す。
 * よくある質問の元は develop-docs の `docs/logru/help.md`。直したら写す。
 */
export function LegalPage({ doc }: { doc: keyof typeof DOCS }) {
  // よくある質問の元は 1 文 1 行で書く。行をつなぐと文の間に空白が入るので、行ごとに折る
  const html = useMemo(() => marked.parse(DOCS[doc], { async: false, breaks: doc === "help" }), [doc]);
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
