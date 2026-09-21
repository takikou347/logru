import { type ReactNode, useEffect, useId, useRef } from "react";

/** 下から出るシート。PC では中央のダイアログになる */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, textarea, button:not(.grab)");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !ref.current) return;
      // Tab でシートの外へ出ない
      const items = ref.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea, select, a[href], [tabindex="0"]',
      );
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className="sheet glass" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="grab" aria-hidden="true" />
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </>
  );
}
