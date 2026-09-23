import type { TourStep } from "@shared/tours";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMarkTourSeen, useMe } from "@/api/common";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverArrow, PopoverContent } from "@/components/ui/popover";
import { findVisibleTarget, fitsInViewport, shouldShowTour, tourController } from "@/lib/tours";
import { useMediaQuery } from "@/lib/use-media-query";
import { ResponsiveSheet } from "./ResponsiveSheet";

/** 指す場所が現れるのを待つ長さ。読み込みが遅い画面でも、この長さで見つかったものだけで始める */
const WAIT_MS = 2500;
/** 待つ間に探し直す間隔 */
const POLL_MS = 250;
/** スマホの下に浮かぶ操作の帯の高さ。ここに入る場所は隠れるとみなす */
const MOBILE_BOTTOM_INSET = 110;

/**
 * 画面ごとの案内(コーチマーク)。初めて開いた画面で 1 回だけ出す。F-33
 *
 * 部品の横に矢印つきの吹き出しを出し、1 枚ずつ進める。「分かった」で次へ、「もう出さない」か外を押すと終わる。
 * 終わると見たことを保存し、別の端末でも出なくなる。指す場所が隠れていれば、下から出るシートで読ませる。
 * 出す条件は lib/tours.ts の shouldShowTour にある
 *
 * @param id 画面の ID。tours_seen に入る
 * @param steps 案内の中身。画面に無い場所を指す 1 枚は飛ばす
 */
export function ScreenTour({ id, steps }: { id: string; steps: TourStep[] }) {
  const me = useMe();
  if (steps.length === 0 || !shouldShowTour(me.data, id)) return null;
  return <TourRunner key={id} id={id} steps={steps} />;
}

/** 指す場所が画面に現れるのを待ち、見つかった分だけで案内を始める */
function TourRunner({ id, steps }: { id: string; steps: TourStep[] }) {
  const [ready, setReady] = useState<TourStep[] | null>(null);

  useEffect(() => {
    const started = Date.now();
    const found = () => steps.filter((s) => !s.target || findVisibleTarget(s.target));
    const timer = window.setInterval(() => {
      const now = found();
      if (now.length === steps.length || Date.now() - started >= WAIT_MS) {
        window.clearInterval(timer);
        setReady(now);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [steps]);

  // 指す場所が 1 つも無ければ出さない。見たことにもしない。次に開いたときにまた探す
  if (!ready || ready.length === 0) return null;
  return <TourView id={id} steps={ready} />;
}

/** 案内の本体。1 枚ずつ、吹き出しかシートで出す */
function TourView({ id, steps }: { id: string; steps: TourStep[] }) {
  const mark = useMarkTourSeen();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [ctl] = useState(() => tourController(steps.length, () => mark.mutate(id)));
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const step = steps[index]!;

  // 1 枚ごとに、指す場所が見えているかを測る。隠れていればシートにする
  useLayoutEffect(() => {
    const el = step.target ? findVisibleTarget(step.target) : null;
    const fits =
      el &&
      fitsInViewport(el.getBoundingClientRect(), { height: window.innerHeight }, desktop ? 0 : MOBILE_BOTTOM_INSET);
    setAnchor(fits ? el : null);
  }, [step, desktop]);

  // 指している場所を囲んで、どこの話かを見せる。囲みの見た目は globals.css にある
  useEffect(() => {
    if (!anchor || done) return;
    anchor.setAttribute("data-tour-active", "");
    return () => anchor.removeAttribute("data-tour-active");
  }, [anchor, done]);

  const sync = () => {
    setIndex(ctl.index);
    setDone(ctl.finished);
  };
  const next = () => {
    ctl.next();
    sync();
  };
  const dismiss = () => {
    ctl.dismiss();
    sync();
  };

  if (done) return null;
  const body = (
    <TourBody text={step.text} index={index} total={steps.length} onNext={next} onDismiss={dismiss} sheet={!anchor} />
  );

  if (!anchor) {
    return (
      <ResponsiveSheet title="この画面の案内" onClose={dismiss}>
        {body}
      </ResponsiveSheet>
    );
  }
  return (
    <Popover key={index} open onOpenChange={(open) => !open && dismiss()}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent
        aria-label="この画面の案内"
        side="bottom"
        align="center"
        sideOffset={10}
        collisionPadding={16}
        className="glass flex w-[min(300px,calc(100vw-32px))] flex-col gap-3 rounded-[22px] border-(--glass-edge) bg-(--glass-flat) p-4 text-ink"
        // 読み上げで文言を読んだあと、すぐ「分かった」を押せるようにする
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.querySelector<HTMLButtonElement>("[data-tour-ok]")?.focus();
        }}
      >
        {body}
        <PopoverArrow width={16} height={8} className="fill-(--glass-flat)" />
      </PopoverContent>
    </Popover>
  );
}

/** 案内の中身。文言、何枚目か、「もう出さない」と「分かった」 */
function TourBody({
  text,
  index,
  total,
  onNext,
  onDismiss,
  sheet,
}: {
  text: string;
  index: number;
  total: number;
  onNext: () => void;
  onDismiss: () => void;
  sheet: boolean;
}) {
  const ok = useRef<HTMLButtonElement>(null);
  // シートは開いた後に「分かった」へ移す。吹き出しは onOpenAutoFocus で移す
  useEffect(() => {
    if (!sheet) return;
    const t = window.setTimeout(() => ok.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [sheet]);

  return (
    <>
      <p className="text-[14px] leading-relaxed">{text}</p>
      <div className="flex items-center gap-2">
        {total > 1 && (
          <span className="text-xs text-ink-2">
            {index + 1} / {total}
          </span>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onDismiss}>
          もう出さない
        </Button>
        <Button ref={ok} size="sm" data-tour-ok onClick={onNext}>
          分かった
        </Button>
      </div>
    </>
  );
}
