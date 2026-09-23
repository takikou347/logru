/** はじめての案内(OnboardingSheet)が使う API の hook。F-32 */

import type { Me } from "@shared/api-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

/**
 * 案内を見終えたか飛ばしたと送る。別の端末でも、もう出さない。
 * 押した瞬間に画面に効かせる。送れなくても、次に開いたときにまた出るだけなので知らせない
 */
export function useFinishOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ onboardedAt: number }>("/me/onboarding", { method: "PUT", keepalive: true }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: keys.me });
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev && prev.onboardedAt === null) qc.setQueryData<Me>(keys.me, { ...prev, onboardedAt: Date.now() });
    },
  });
}
