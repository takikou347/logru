import { clientExtensions } from "@extensions/client/registry";
import { Link, useParams } from "react-router";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { ExtensionToggleRow } from "@/components/parts/ExtensionToggleRow";
import { FailurePanel } from "@/components/parts/Failure";
import { Dot, Empty, FieldMessage, Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { groupColor } from "@/lib/colors";
import { poolColorsOf } from "../calendar/model";
import { SettingsShell } from "./components/SettingsShell";
import { useSetExtensionEnabled } from "./extensions-api";

/**
 * 拡張の詳細。設定の「機能」から移る。issue #102
 *
 * 決まり: 拡張の設定は、その拡張の詳細に置く。切り替えられる拡張は「自分で使う」と「使うグループ」を、
 * 設定の欄(SettingsSection)を持つ拡張は「この機能の設定」を出す。無い節は出さない。
 */
export function ExtensionDetailPage() {
  const { key = "" } = useParams();
  const me = useMe();
  const groups = useGroups();
  const setEnabled = useSetExtensionEnabled();
  const ext = clientExtensions.find((x) => x.manifest.key === key);

  if (groups.isPending || me.isPending) return <Loading />;

  if (!ext || !me.data) {
    return (
      <SettingsShell
        title="機能"
        poolColors={poolColorsOf(groups.data ?? [], me.data)}
        back="/settings/extensions"
        backMobileOnly={false}
      >
        <FailurePanel
          mark="?"
          title="機能が見つかりません"
          action={
            <Button asChild variant="secondary">
              <Link to="/settings/extensions">機能の一覧へ</Link>
            </Button>
          }
        >
          使えない機能か、URL が違います。
        </FailurePanel>
      </SettingsShell>
    );
  }

  const { manifest, SettingsSection } = ext;
  const toggleable = !manifest.alwaysOn && !manifest.perUser;
  const list = groups.data ?? [];
  const personal = list.find((g) => g.isPersonal);
  const shared = list.filter((g) => !g.isPersonal);
  const personalChecked = Boolean(personal?.extensions.includes(key));
  const personalPending = setEnabled.isPending && setEnabled.variables?.groupId === personal?.id;

  return (
    <SettingsShell
      title={manifest.label}
      poolColors={poolColorsOf(list, me.data)}
      back="/settings/extensions"
      backMobileOnly={false}
    >
      {toggleable && (
        <Panel title="自分で使う">
          <ExtensionToggleRow
            label={`${manifest.label}を使う`}
            checked={personalChecked}
            canToggle={Boolean(personal)}
            pending={personalPending}
            onToggle={(enabled) => personal && setEnabled.mutate({ groupId: personal.id, key, enabled })}
          />
          <FieldMessage>
            使うと、共有しない記録はいつでも残せます。グループで共有するには、下でそのグループを選びます。
          </FieldMessage>
        </Panel>
      )}

      {toggleable && (
        <Panel title="使うグループ">
          {shared.length === 0 ? (
            <Empty>まだ共有のグループがありません。</Empty>
          ) : (
            <div>
              {shared.map((g) => {
                const checked = g.extensions.includes(key);
                const pending = setEnabled.isPending && setEnabled.variables?.groupId === g.id;
                return (
                  <ExtensionToggleRow
                    key={g.id}
                    icon={<Dot color={groupColor(g, me.data.colorPrefs)} className="size-3" />}
                    label={g.name}
                    checked={checked}
                    canToggle={g.role === "admin"}
                    pending={pending}
                    onToggle={(enabled) => setEnabled.mutate({ groupId: g.id, key, enabled })}
                  />
                );
              })}
            </div>
          )}
          <FieldMessage>グループで共有できるのは、そのグループの管理者だけです。</FieldMessage>
        </Panel>
      )}

      {SettingsSection && <SettingsSection />}
    </SettingsShell>
  );
}
