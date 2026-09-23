import { matchInvitePath, rewriteInviteMeta } from "@server/core/invite-og";
import { describe, expect, it } from "vitest";

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Logru" />
    <meta property="og:description" content="カレンダーを土台に、使いたい機能だけを足して使うアプリ。" />
    <meta property="og:image" content="https://logru-production.tkkwkut-400.workers.dev/og-image.png" />
    <meta property="og:url" content="https://logru-production.tkkwkut-400.workers.dev/" />
    <meta name="twitter:card" content="summary_large_image" />
    <title>Logru</title>
  </head>
  <body></body>
</html>`;

describe("matchInvitePath", () => {
  it("/invite/:token の token を取り出す", () => {
    expect(matchInvitePath("/invite/abc123")).toBe("abc123");
  });

  it("招待リンク以外は null", () => {
    expect(matchInvitePath("/")).toBeNull();
    expect(matchInvitePath("/invite")).toBeNull();
    expect(matchInvitePath("/invite/abc/extra")).toBeNull();
    expect(matchInvitePath("/api/invites/abc")).toBeNull();
  });
});

describe("rewriteInviteMeta", () => {
  it("招待リンク用の文言に書き換え、グループの名前は入れない", () => {
    const out = rewriteInviteMeta(html, "https://logru-staging.tkkwkut-400.workers.dev", "abc123");
    expect(out).toContain('<meta property="og:title" content="Logru への招待" />');
    expect(out).toContain(
      '<meta property="og:description" content="Logru で、いっしょに予定を分け合いませんか。リンクから参加できます。" />',
    );
    expect(out).toContain(
      '<meta property="og:url" content="https://logru-staging.tkkwkut-400.workers.dev/invite/abc123" />',
    );
    expect(out).toContain(
      '<meta property="og:image" content="https://logru-staging.tkkwkut-400.workers.dev/og-image.png" />',
    );
    expect(out).not.toContain("グループ");
  });

  it("ほかのタグはそのまま残す", () => {
    const out = rewriteInviteMeta(html, "https://logru-production.tkkwkut-400.workers.dev", "abc123");
    expect(out).toContain('<meta property="og:type" content="website" />');
    expect(out).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(out).toContain("<title>Logru</title>");
  });
});
