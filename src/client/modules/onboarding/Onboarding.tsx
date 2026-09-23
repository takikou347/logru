import type { Me } from "@shared/api-types";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useFinishOnboarding } from "./api";
import { E2E_SKIP_KEY, REOPEN_PARAM, shouldShowOnboarding } from "./model";
import { OnboardingSheet } from "./OnboardingSheet";

/** E2E のほかのテストでは出さない。エミュレーターにつないだ組み立てでだけ、印を読む */
function skippedForE2E(): boolean {
  if (!import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) return false;
  try {
    return localStorage.getItem(E2E_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * カレンダーに置く、はじめての案内の出し入れ。F-32、0035
 *
 * 見終えていない人がカレンダーに着くと出す。規約への同意と招待への参加は、カレンダーに着く前に済む。
 * 設定から `/?onboarding=1` で開くと、見終えた人にも出す。
 * 閉じると見終えたと送り、別の端末でも出さない。
 *
 * @param paused 予定のシートを開いているあいだ true。閉じたら同じ枚から続ける
 * @param onAddEvent 2 枚目の「予定を 1 つ足してみる」。予定のシートを開く
 */
export function Onboarding({ me, paused, onAddEvent }: { me: Me; paused: boolean; onAddEvent: () => void }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const reopen = params.get(REOPEN_PARAM) === "1";
  const [step, setStep] = useState(0);
  const [closed, setClosed] = useState(false);
  const [skipped] = useState(skippedForE2E);
  const finish = useFinishOnboarding();

  // 設定から開き直したら、最初の枚から出す
  useEffect(() => {
    if (!reopen) return;
    setClosed(false);
    setStep(0);
  }, [reopen]);

  const show = !closed && (reopen || !skipped) && shouldShowOnboarding(me.onboardedAt, reopen);
  if (!show || paused) return null;

  function done(to?: string) {
    setClosed(true);
    if (me.onboardedAt === null) finish.mutate();
    if (to) {
      navigate(to);
      return;
    }
    if (reopen) {
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.delete(REOPEN_PARAM);
          return q;
        },
        { replace: true },
      );
    }
  }

  return (
    <OnboardingSheet
      me={me}
      step={step}
      onStep={setStep}
      onAddEvent={() => {
        // 予定のシートを閉じたら、次の枚から続ける
        setStep(2);
        onAddEvent();
      }}
      onDone={done}
    />
  );
}
