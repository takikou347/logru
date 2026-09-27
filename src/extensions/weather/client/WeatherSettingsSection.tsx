import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FieldMessage, Panel, PanelRow } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDeleteWeatherLocation,
  useSaveWeatherLocation,
  useSearchPlaces,
  useWeatherLocation,
  type WeatherPlace,
} from "./api";

/** 探す文字を止めてから API を呼ぶまでの間 */
const DEBOUNCE_MS = 300;

/** `渋谷区、東京都、日本` の形に、分かっているものだけをつなげる */
function describePlace(place: WeatherPlace): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join("、");
}

/**
 * 設定の画面の「天気」の欄。いつもの場所を検索して選ぶ、変える、消す。F-401、F-402
 * 出どころの表示を出す。Open-Meteo の CC BY 4.0 に従う。F-405
 */
export function WeatherSettingsSection() {
  const location = useWeatherLocation();
  const remove = useDeleteWeatherLocation();
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <Panel title="天気">
      <FieldMessage>
        いつもの場所を選ぶと、今日から 6 日後までの天気がカレンダーに、しおりの日には自動でその日の天気が出ます。
        気象データ: Open-Meteo.com
      </FieldMessage>
      {location.error && <FieldMessage error>{location.error.message}</FieldMessage>}
      {location.isSuccess && (
        <PanelRow>
          <span className="text-ink-2">いつもの場所</span>
          <span className="min-w-0 text-right break-words">{location.data?.name ?? "まだ選んでいません"}</span>
        </PanelRow>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" className="self-start" onClick={() => setPicking(true)}>
          {location.data ? "場所を変える" : "場所を選ぶ"}
        </Button>
        {location.data && (
          <Button variant="ghost" className="self-start" onClick={() => setRemoving(true)}>
            消す
          </Button>
        )}
      </div>

      {picking && <PickPlaceSheet onClose={() => setPicking(false)} />}
      {removing && location.data && (
        <RemoveLocationSheet
          name={location.data.name}
          busy={remove.isPending}
          onClose={() => setRemoving(false)}
          onRemove={async () => {
            try {
              await remove.mutateAsync();
              toast("いつもの場所を消しました");
              setRemoving(false);
            } catch (err) {
              toast.error((err as Error).message);
            }
          }}
        />
      )}
    </Panel>
  );
}

/** 市区町村を検索して選ぶシート */
function PickPlaceSheet({ onClose }: { onClose: () => void }) {
  const save = useSaveWeatherLocation();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const results = useSearchPlaces(debounced);
  const query = debounced.trim();
  // 押した行だけに読み込み中の印を出す。保存が終わるまで、ほかの行も含めて押せなくする
  const savingId = save.isPending ? save.variables?.id : undefined;

  async function pick(place: WeatherPlace) {
    try {
      await save.mutateAsync(place);
      toast(`いつもの場所を${place.name}にしました`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <ResponsiveSheet title="場所を選ぶ" onClose={onClose}>
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="市区町村の名前で探す"
        aria-label="市区町村の名前で探す"
      />
      {query.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">市区町村の名前を入れて探します。</p>
      ) : results.isLoading ? (
        <p className="py-6 text-center text-sm text-ink-2">探しています…</p>
      ) : (results.data ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-2">見つかりませんでした。</p>
      ) : (
        <ul className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto" aria-label="場所の候補">
          {(results.data ?? []).map((place) => (
            <li key={place.id} className="border-line not-first:border-t">
              <button
                type="button"
                className="flex min-h-14 w-full items-center justify-between gap-2 rounded-[14px] px-2 py-2 text-left disabled:opacity-50"
                disabled={save.isPending}
                aria-busy={savingId === place.id}
                onClick={() => pick(place)}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{describePlace(place)}</span>
                {savingId === place.id && (
                  <span className="flex flex-none items-center gap-1.5 text-xs text-ink-2">
                    保存しています
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ResponsiveSheet>
  );
}

/** いつもの場所を消す前の確認 */
function RemoveLocationSheet({
  name,
  busy,
  onClose,
  onRemove,
}: {
  name: string;
  busy: boolean;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <ResponsiveSheet
      title={`${name} を消す`}
      description="天気は、カレンダーからもしおりの日からも出なくなります。"
      onClose={onClose}
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          やめる
        </Button>
        <Button type="button" variant="danger" disabled={busy} onClick={onRemove}>
          消す
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
