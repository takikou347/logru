// 規約を改めたら版を上げる。上げると、全員に次のログインで同意を取り直す
export const LEGAL_VERSIONS = {
  terms: "2026-09-25",
  privacy: "2026-09-25",
} as const;

export type LegalDocument = keyof typeof LEGAL_VERSIONS;
