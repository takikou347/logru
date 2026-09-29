/**
 * ホーム(`/`)の行き先を決める。0091 の「困ること」に残っていた「今日タブとカレンダータブが
 * 同じ画面を指す」を、この画面で解く。0092、issue #240
 *
 * ラボの「新しい見た目」を入れたスマホ(1024px 未満)で、URL に view を持たなければ今日のページ。
 * それ以外(入れていない人、PC、view を持つとき)はカレンダー(月・週・日)のまま。
 * 下のタブの「今日のページ」は `/` へ、「カレンダー」は `/?view=month` へ移る(GlobalBottomTabs)ので、
 * この分け方でタブどおりに行き先が分かれる。
 */
import { useSearchParams } from "react-router";
import { useNewLookActive } from "@/lib/lab";
import { useMediaQuery } from "@/lib/use-media-query";
import { CalendarPage } from "../calendar/CalendarPage";
import { TodayPage } from "./TodayPage";

export function HomeRoute() {
  const [params] = useSearchParams();
  const newLook = useNewLookActive();
  const mobile = !useMediaQuery("(min-width: 1024px)");
  const showToday = newLook && mobile && !params.has("view");
  return showToday ? <TodayPage /> : <CalendarPage />;
}
