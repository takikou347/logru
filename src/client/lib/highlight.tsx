/**
 * 探した文字を、結果の中で `<mark>` で囲む。
 * 大文字と小文字、全角と半角は区別しない(NFKC と toLowerCase でそろえる)。
 */

export type Segment = { text: string; match: boolean };

const fold = (s: string) => s.normalize("NFKC").toLowerCase();

/** 濁点や結合文字は、前の文字と一緒に NFKC をかけないと 1 文字にそろわない */
const MARK = /^[\p{M}\uFF9E\uFF9F]$/u;
function clusters(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    if (out.length > 0 && MARK.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/**
 * text を、query に一致する所と、しない所に分ける。位置は元の text のまま返す。
 * NFKC で長さが変わる文字(㈱、ﾊﾟ など)があっても、元の文字を割らない。
 * 一致が無い、query が空のときは全体を 1 つ返す。
 */
export function splitByMatch(text: string, query: string): Segment[] {
  const q = fold(query.trim());
  if (q.length === 0 || text.length === 0) return [{ text, match: false }];

  // そろえた文字列の 1 文字ごとに、元の文字列での始まりと終わりを持つ
  let folded = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let pos = 0;
  for (const ch of clusters(text)) {
    const f = fold(ch);
    for (let i = 0; i < f.length; i++) {
      starts.push(pos);
      ends.push(pos + ch.length);
    }
    folded += f;
    pos += ch.length;
  }

  const segments: Segment[] = [];
  let cursor = 0;
  let from = 0;
  while (from <= folded.length - q.length) {
    const hit = folded.indexOf(q, from);
    if (hit < 0) break;
    const start = starts[hit] ?? 0;
    const end = ends[hit + q.length - 1] ?? text.length;
    // 元の 1 文字の途中から始まる一致は、その文字ごと囲む。前の一致と重なる分は切る
    const s = Math.max(start, cursor);
    if (s > cursor) segments.push({ text: text.slice(cursor, s), match: false });
    if (end > s) segments.push({ text: text.slice(s, end), match: true });
    cursor = Math.max(cursor, end);
    from = hit + q.length;
  }
  if (segments.length === 0) return [{ text, match: false }];
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}

/** 一致した所を `<mark>` で囲んで返す。色は --accent の薄い色、文字の色は変えない */
export function Highlight({ text, query }: { text: string; query: string }) {
  const segments = splitByMatch(text, query);
  if (segments.length === 1 && !segments[0]?.match) return <>{text}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.match ? (
          <mark key={i} className="rounded-xs bg-[color-mix(in_srgb,var(--accent)_28%,transparent)] text-inherit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
