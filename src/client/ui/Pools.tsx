/**
 * グループの色のインクだまり。ガラスの裏に置く。0010
 * focus を渡すと、その色だけが膨らみ、ほかは引く。
 */
export function Pools({ colors, focus }: { colors: string[]; focus?: number | null }) {
  const [a = "wakatake", b = "yamabuki", c = "asagi"] = colors;
  return (
    <div className="pools" data-focus={focus == null ? undefined : focus + 1} aria-hidden="true">
      <i className={`pool p1 c-${a}`} />
      <i className={`pool p2 c-${b}`} />
      <i className={`pool p3 c-${c}`} />
    </div>
  );
}
