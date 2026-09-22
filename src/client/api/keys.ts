/** 読み込むデータの名前。書き換えた後に、ここを指して読み直させる。複数の機能で使う土台のキーだけを置く */
export const keys = {
  me: ["me"] as const,
  groups: ["groups"] as const,
  calendar: (from: number, to: number) => ["calendar", from, to] as const,
};
