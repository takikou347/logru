/**
 * 設定の「通知」の、種類ごとの「一覧に出す」「端末にも知らせる」。機能ごとにまとめて出す。0096、F-47
 * 変えていない種類は、拡張の manifest か CORE_NOTIFICATION_KINDS の既定のまま。
 */
import { notificationKindGroups } from "@extensions/client/registry";
import type { NotificationPref } from "@shared/notifications";
import { useMe, useSetNotificationPref } from "@/api/common";
import { Panel, PanelRow } from "@/components/parts/Panel";
import { Switch } from "@/components/ui/switch";

export function NotificationKindsSection() {
  const me = useMe();
  const setPref = useSetNotificationPref();
  if (!me.data) return null;
  const prefs = me.data.settings.notificationPrefs;
  const groups = notificationKindGroups();

  return (
    <>
      {groups.map((group) => (
        <Panel key={group.key} title={group.label}>
          {group.kinds.map((def) => {
            const pref: NotificationPref = prefs[def.kind] ?? { list: def.defaultList, push: def.defaultPush };
            const update = (next: NotificationPref) => setPref.mutate({ kind: def.kind, pref: next });
            return (
              <PanelRow key={def.kind} className="flex-col items-stretch gap-1.5 py-2 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">{def.label}</span>
                <span className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-ink-2">
                    <Switch
                      checked={pref.list}
                      aria-label={`${def.label}を一覧に出す`}
                      onCheckedChange={(list) => update({ ...pref, list })}
                    />
                    一覧
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-2">
                    <Switch
                      checked={pref.push}
                      aria-label={`${def.label}を端末にも知らせる`}
                      onCheckedChange={(push) => update({ ...pref, push })}
                    />
                    端末
                  </span>
                </span>
              </PanelRow>
            );
          })}
        </Panel>
      ))}
    </>
  );
}
