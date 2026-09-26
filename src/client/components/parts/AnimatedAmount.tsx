import { type ComponentProps, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** 数字が短く動く長さ。globals.css の .amount-flip と同じ --dur-base(220ms)。0044、0085、#226 */
const FLIP_MS = 220;

/**
 * 金額などの数字。足す・消すで値が変わったときだけ、下からわずかに入れ替わる動きを 1 度だけ再生する。
 * 最初に描いたときは動かさない。dur-base、ease-out。動きを減らす設定では globals.css の既定の仕組みで止まる。
 * 0044、0085、#226
 * @param value 表示する文字。`¥1,200` のように整えたものを渡す
 */
export function AnimatedAmount({
  value,
  className,
  ...rest
}: { value: string } & Omit<ComponentProps<"span">, "children">) {
  const prev = useRef(value);
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setFlip(true);
    const t = window.setTimeout(() => setFlip(false), FLIP_MS);
    return () => window.clearTimeout(t);
  }, [value]);
  return (
    <span className={cn(className, flip && "amount-flip")} {...rest}>
      {value}
    </span>
  );
}
