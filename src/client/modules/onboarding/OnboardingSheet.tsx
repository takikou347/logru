import { clientExtension } from "@extensions/client/registry";
import type { Me } from "@shared/api-types";
import { GROUP_COLORS } from "@shared/colors";
import { profileInput } from "@shared/schemas";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { useGroups } from "@/api/common";
import { Notice } from "@/components/layout/AuthShell";
import { ColorSwatches } from "@/components/parts/ColorSwatches";
import { Field } from "@/components/parts/Field";
import { Mascot } from "@/components/parts/Mascot";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extensionIcon } from "@/lib/extension-visuals";
import { useAddableExtensions } from "@/lib/extensions";
import { markExtensionJustAdded } from "@/lib/recent-extension-adds";
import { cn } from "@/lib/utils";
import { useCreateGroup } from "../groups/api";
import { useUpdateName, useUpdateSettings } from "../settings/api";
import { useSetExtensionEnabled } from "../settings/extensions-api";
import { inviteTokenOf } from "./model";

/** 1 枚ずつの見出し。並びがそのまま進む順。4 枚目は足せる機能が無ければ出さない。issue #222 */
const BASE_TITLES = ["Logru へようこそ", "予定を足す", "グループで共有する"] as const;
const FEATURE_TITLE = "機能を足す";

/** 4 枚目で紹介する機能。家計簿・共有リスト・思い出・天気の順。issue #222 */
const FEATURE_KEYS = ["kakeibo", "lists", "memories", "weather"] as const;

/**
 * はじめての案内。3〜4 枚のシートを 1 枚ずつ進む。各枚に、その場でできる操作を 1 つ置く。F-32、0035
 *
 * 進み具合は上に点で出し、「飛ばす」は右上、「次へ」は下に置く。
 * シートなので、フォーカスは中に閉じる。Esc や外側を押したときも、飛ばしたのと同じに扱う。
 *
 * 4 枚目(機能を足す)は、開いた時点でまだ足せる機能が 1 つも無ければ出さない。issue #222、#224
 *
 * @param step いまの枚。0 から数える。予定を足すあいだ閉じても戻れるよう、親が持つ
 * @param onStep 枚を移るとき
 * @param onAddEvent 「予定を 1 つ足してみる」。親が予定のシートを開く
 * @param onDone 閉じるとき。to があれば、閉じたあとにそこへ移る
 */
export function OnboardingSheet({
  me,
  step,
  onStep,
  onAddEvent,
  onDone,
}: {
  me: Me;
  step: number;
  onStep: (step: number) => void;
  onAddEvent: () => void;
  onDone: (to?: string) => void;
}) {
  const [name, setName] = useState(me.user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const updateName = useUpdateName();
  const settings = useUpdateSettings();
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const groups = useGroups();
  const addable = useAddableExtensions();
  // 足せる機能があるかは、開いた最初にグループを読み終えた時点で 1 度だけ決める。読み込み中は
  // 楽観的に「ある」とみなす(通常はそのあいだに 4 枚目まで進まない)。途中で足しても、
  // このシートを開いている間は 4 枚目の有無を変えない。issue #224
  const featureStepRef = useRef<{ show: boolean; addableKeys: Set<string> } | null>(null);
  if (featureStepRef.current === null && groups.data) {
    featureStepRef.current = { show: addable.length > 0, addableKeys: new Set(addable.map((x) => x.manifest.key)) };
  }
  const showFeatureStep = featureStepRef.current?.show ?? true;
  const featureAddableKeys = featureStepRef.current?.addableKeys ?? new Set(FEATURE_KEYS);
  const personalGroupId = groups.data?.find((g) => g.isPersonal)?.id ?? null;

  const titles = showFeatureStep ? [...BASE_TITLES, FEATURE_TITLE] : BASE_TITLES;
  const ONBOARDING_STEPS = titles.length;
  const last = step === ONBOARDING_STEPS - 1;

  // biome-ignore lint/correctness/useExhaustiveDependencies: step は使わないが、枚を移るたびに本文へフォーカスを移したい。読み上げで続きから読めるように
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    bodyRef.current?.focus();
  }, [step]);

  /** 1 枚目で決めた表示名を送ってから進む。空なら進まない */
  function next() {
    if (step === 0) {
      const parsed = profileInput.safeParse({ name });
      if (!parsed.success) {
        setNameError(parsed.error.issues[0]?.message ?? "入力が正しくありません。");
        return;
      }
      if (parsed.data.name !== me.user.name) updateName.mutate(parsed.data.name);
    }
    onStep(Math.min(step + 1, ONBOARDING_STEPS - 1));
  }

  const bar = (
    <>
      <Dots step={step} titles={titles} />
      <Button variant="ghost" size="sm" onClick={() => onDone()}>
        飛ばす
      </Button>
    </>
  );

  return (
    <ResponsiveSheet title={titles[step] ?? titles[0]} bar={bar} onClose={() => onDone()}>
      <div
        ref={bodyRef}
        tabIndex={-1}
        className="flex flex-col gap-3.5 text-sm leading-7 outline-none"
        data-testid="onboarding-step"
      >
        {step === 0 && (
          <>
            {/* 手を振るメクリで迎える。0053、#179 */}
            <Mascot pose="wave" className="self-center" />
            <p>Logru はカレンダーが土台です。要る機能だけを足して使います。</p>
            <p>はじめに、表示名と自分の色を決めましょう。あとから設定で変えられます。</p>
            <Field label="表示名" error={nameError}>
              {(p) => (
                <Input
                  {...p}
                  value={name}
                  maxLength={40}
                  autoComplete="nickname"
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    next();
                  }}
                />
              )}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">自分の色</span>
              <ColorSwatches
                label="自分の色"
                value={me.settings.userColor}
                options={GROUP_COLORS}
                onChange={(userColor) => settings.mutate({ ...me.settings, userColor })}
              />
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p>下の「＋」で、選んでいる日に予定を足せます。</p>
            <Button variant="secondary" className="self-start" onClick={onAddEvent}>
              予定を 1 つ足してみる
            </Button>
          </>
        )}
        {step === 2 && <GroupStep onJoin={(token) => onDone(`/invite/${token}`)} />}
        {step === 3 && showFeatureStep && <FeatureStep addableKeys={featureAddableKeys} groupId={personalGroupId} />}
      </div>

      <div className="mt-1 flex items-center gap-2">
        {step > 0 && (
          <Button variant="ghost" onClick={() => onStep(step - 1)}>
            戻る
          </Button>
        )}
        {last ? (
          <>
            <Button variant="secondary" className="ml-auto" onClick={() => onDone()}>
              あとで
            </Button>
            <Button onClick={() => onDone("/settings/extensions")}>機能の一覧へ</Button>
          </>
        ) : (
          <Button className="ml-auto min-w-28" onClick={next}>
            次へ
          </Button>
        )}
      </div>
    </ResponsiveSheet>
  );
}

/** 進み具合の点。いまの枚だけ長くする。titles は、4 枚目を出さないときは 3 枚になる */
function Dots({ step, titles }: { step: number; titles: readonly string[] }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={`${titles.length} 枚中 ${step + 1} 枚目`}>
      {titles.map((t, i) => (
        <span
          key={t}
          className={cn("h-2 rounded-full transition-[width]", i === step ? "w-5 bg-primary" : "w-2 bg-line")}
        />
      ))}
    </div>
  );
}

/** 3 枚目。グループを作るか、もらった招待リンクを貼る。どちらも飛ばしてよい */
function GroupStep({ onJoin }: { onJoin: (token: string) => void }) {
  const createGroup = useCreateGroup();
  const [groupName, setGroupName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setGroupError(null);
    try {
      const g = await createGroup.mutateAsync(groupName);
      setCreated(g.name);
      setGroupName("");
    } catch (err) {
      setGroupError((err as Error).message);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const token = inviteTokenOf(link);
    if (!token) {
      setLinkError("招待リンクをそのまま貼ってください。");
      return;
    }
    onJoin(token);
  }

  return (
    <>
      <p>グループを作ると、パートナーや家族と予定を共有できます。</p>
      <MiniForm onSubmit={create} button="作る" disabled={createGroup.isPending || !groupName.trim()}>
        <Field label="グループの名前" error={groupError} hint="例: ふたり、実家">
          {(p) => <Input {...p} value={groupName} maxLength={30} onChange={(e) => setGroupName(e.target.value)} />}
        </Field>
      </MiniForm>
      {created && <Notice role="status">「{created}」を作りました。招待リンクは、グループの画面で出せます。</Notice>}
      <MiniForm onSubmit={join} button="入る" disabled={!link.trim()}>
        <Field label="もらった招待リンク" error={linkError}>
          {(p) => (
            <Input
              {...p}
              value={link}
              inputMode="url"
              placeholder="https://…/invite/…"
              onChange={(e) => {
                setLink(e.target.value);
                setLinkError(null);
              }}
            />
          )}
        </Field>
      </MiniForm>
    </>
  );
}

/**
 * 4 枚目。まだ足していない機能を 1 行ずつ見せ、行ごとの「足す」でその場で足せる。何も選ばずに次へ進んでよい。
 * 開いた時点で足せなかった機能(すでに足している、いつも有効な天気など)は、初めから「使えます」の行にする。
 * 足した行だけが、押した瞬間に「足しました」に変わる。issue #222
 *
 * @param addableKeys 開いた時点で足せた機能の key。ExtensionAddPage と同じ、有効にする API と hook を使う
 * @param groupId 自分だけのグループの ID。まだ読めていなければ「足す」を押せない
 */
function FeatureStep({ addableKeys, groupId }: { addableKeys: Set<string>; groupId: string | null }) {
  const setEnabled = useSetExtensionEnabled();
  const [added, setAdded] = useState<Set<string>>(new Set());

  function add(key: string) {
    if (!groupId) return;
    setEnabled.mutate(
      { groupId, key, enabled: true },
      {
        onSuccess: () => {
          markExtensionJustAdded(key);
          setAdded((s) => new Set(s).add(key));
        },
      },
    );
  }

  return (
    <>
      <p>すぐ使いたい機能があれば、この場で足せます。あとから設定でも足し外しできます。</p>
      <ul className="flex flex-col gap-2">
        {FEATURE_KEYS.map((key) => {
          const ext = clientExtension(key);
          if (!ext) return null;
          const Icon = extensionIcon(key);
          const addable = addableKeys.has(key);
          const done = !addable || added.has(key);
          return (
            <li
              key={key}
              aria-label={ext.manifest.label}
              className="flex items-center gap-3 rounded-2xl bg-field px-3 py-2.5"
            >
              <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-full bg-primary/15">
                <Icon className="size-5 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{ext.manifest.label}</p>
                <p className="text-xs leading-relaxed text-ink-2">{ext.manifest.description}</p>
              </div>
              {done ? (
                <span className="flex-none text-xs font-medium text-ink-2">{addable ? "足しました" : "使えます"}</span>
              ) : (
                <Button
                  size="sm"
                  className="flex-none"
                  disabled={!groupId || (setEnabled.isPending && setEnabled.variables?.key === key)}
                  onClick={() => add(key)}
                >
                  足す
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p>スマホでは、ホーム画面に追加すると、アプリのように全画面で使えます。</p>
    </>
  );
}

/** 入力欄 1 つとボタン 1 つの小さなフォーム。ボタンは入力欄の横、下端にそろえる */
function MiniForm({
  onSubmit,
  button,
  disabled,
  children,
}: {
  onSubmit: (e: FormEvent) => void;
  button: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <form className="flex items-start gap-2" onSubmit={onSubmit} noValidate>
      <div className="min-w-0 flex-1">{children}</div>
      <Button type="submit" variant="secondary" className="mt-[22px]" disabled={disabled}>
        {button}
      </Button>
    </form>
  );
}
