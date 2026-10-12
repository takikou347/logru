/**
 * 紙吹雪を 1.5 秒ほど降らせる canvas。画面いっぱいに重ね、pointer-events: none で操作を邪魔しない。
 * 色はテーマのトークン(--accent など)から読む。外部のライブラリは使わない。F-412、0098、0044
 */
import { useEffect, useRef } from "react";
import { CONFETTI_MS, fadeAt, makeParticles, stepParticle } from "@/lib/confetti";

const COLOR_VARS = ["--accent", "--beni", "--kogecha", "--fukamidori", "--kon"] as const;

export function Confetti({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      done.current();
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const style = getComputedStyle(document.documentElement);
    const colors = COLOR_VARS.map((v) => style.getPropertyValue(v).trim()).filter(Boolean);
    if (colors.length === 0) colors.push("currentColor");

    let particles = makeParticles();
    const start = performance.now();
    let last = start;
    let raf = 0;
    const frame = (now: number) => {
      const elapsed = now - start;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (elapsed >= CONFETTI_MS) {
        ctx.clearRect(0, 0, w, h);
        done.current();
        return;
      }
      particles = particles.map((p) => stepParticle(p, dt));
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = fadeAt(elapsed);
      for (const p of particles) {
        ctx.save();
        ctx.translate(p.x * w, p.y * h);
        ctx.rotate(p.rot);
        ctx.fillStyle = colors[p.color % colors.length] ?? "currentColor";
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60]">
      <canvas ref={ref} data-testid="confetti" className="pointer-events-none size-full" />
    </div>
  );
}
