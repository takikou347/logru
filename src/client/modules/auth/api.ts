/** 認証まわりの画面(AgreePage、InvitePage)が使う API の hook */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

/** 最新の規約に同意したことを送る。登録の画面で受けた同意を送るときにも使う */
export function postAgreement(): Promise<void> {
  return api("/me/agreements", { method: "POST", body: { agreed: true } });
}

/** 規約に同意する。同意すると自分の情報を読み直す */
export function useAgreeToLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAgreement,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}
