import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Select, Spinner, Textarea } from '@/components/ui';
import { useGameContext } from '@/contexts/GameContext';
import { useGameActionResults } from '@/hooks/useActionResults';
import { useGmBoard, useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';
import { useSheetLayout } from '@/hooks/useSheetLayout';
import { apiClient } from '@/lib/api';
import { chainsFor } from '@/lib/gmBoard/results';
import { sheetTabsFrom } from '@/lib/gmBoard/rewards';
import { rewardStateFor } from '@/lib/gmBoard/rewardState';
import { parseGroups, parseScales } from '@/lib/gmBoard/template';
import type { GameBoardSettings } from '@/lib/gmBoard/types';

/** A plain starting point for a game with no template yet. */
const STARTER = {
  template: `# Rewards

{{lines result}}

{{if objectives}}## Objectives

{{lines objectives}}{{end}}

{{lines other}}`,
  groups: [
    { key: 'result', label: 'Result' },
    { key: 'objectives', label: 'Objectives' },
    { key: 'other', label: 'Other' },
  ],
};

const TAGS: [string, string][] = [
  ['{{lines result}}', 'Every reward line in that section'],
  ['{{if bonus}}…{{end}}', 'Shown only when the section has lines, a text box is filled in, or a sheet value isn’t 0'],
  ['{{value Numbers/Rating}}', 'A sheet value after this phase (Tab/Entry, or Tab/Entry/Field)'],
  ['{{before Numbers/Rating}}', 'The same, before this phase'],
  ['{{gain Numbers/Rating}}', 'How much it changed, like +2'],
  ['{{max Numbers/Stress}}', 'A track’s maximum'],
  ['{{label Numbers/Rating}}', 'The name for the number, from a scale'],
  ['{{text Comment}}', 'A box you fill in per person in Write'],
  ['{{changes Inventory}}', 'Every change this phase makes on that tab'],
  ['{{name}}', 'The character’s name'],
];

const groupsText = (groups: GameBoardSettings['rewardGroups']) => groups.map((g) => `${g.key}: ${g.label}`).join('\n');
const scalesText = (scales: GameBoardSettings['scales']) => scales.map((s) => `${s.name}: ${s.steps.map((st) => `${st.min} ${st.label}`).join(', ')}`).join('\n');

/**
 * Game setup's reward block: the template (one per game), its sections and
 * scales, and a live preview for one character in one phase with the
 * template's problems listed as you type.
 */
export function GmRewardBlock({ gameId, phases, players }: { gameId: number; phases: { id: number; title: string }[]; players: { id: number; name: string }[] }) {
  const { settings, isLoading } = useGmSettings(gameId);
  if (isLoading || !settings) return <Spinner />;
  return <BlockEditor gameId={gameId} settings={settings} phases={phases} players={players} />;
}

function BlockEditor({ gameId, settings, phases, players }: { gameId: number; settings: GameBoardSettings; phases: { id: number; title: string }[]; players: { id: number; name: string }[] }) {
  const store = useGmSettingsStore(gameId);
  const { game } = useGameContext();
  const layout = useSheetLayout(game).tabs;
  // The text boxes keep what's typed; the parsed values are what's saved.
  const [groupsDraft, setGroupsDraft] = useState(() => groupsText(settings.rewardGroups));
  const [scalesDraft, setScalesDraft] = useState(() => scalesText(settings.scales));
  const [phaseId, setPhaseId] = useState(phases[phases.length - 1]?.id ?? 0);
  const [who, setWho] = useState(players[0]?.id ?? 0);
  const { board } = useGmBoard(gameId, phaseId, { enabled: phaseId > 0 });
  const results = useGameActionResults(gameId);
  const sheets = useQuery({
    queryKey: ['gameCharacterData', gameId],
    queryFn: () => apiClient.characters.getGameCharacterData(gameId).then((r) => r.data),
    enabled: gameId > 0,
    staleTime: 60_000,
  });

  const setTemplate = (text: string) => store.update('template', 'template', () => ({ text }));
  const setGroups = (groups: GameBoardSettings['rewardGroups']) => store.update('groups', 'groups', () => ({ groups }));
  const setScales = (scales: GameBoardSettings['scales']) => store.update('scales', 'scales', () => ({ scales }));

  const preview = useMemo(
    () =>
      who
        ? rewardStateFor({
            settings,
            phaseItems: board?.rewardItems ?? [],
            layout,
            name: players.find((p) => p.id === who)?.name ?? '',
            rewards: board?.rewards[who],
            live: sheetTabsFrom(sheets.data?.[String(who)], layout),
            chains: chainsFor(results.data ?? [], phaseId, who),
          }).block
        : { text: '', problems: [] },
    [who, settings, board, layout, players, sheets.data, results.data, phaseId],
  );

  return (
    <div className="space-y-4" data-testid="gm-reward-block">
      <p className="text-sm text-content-secondary">
        Your own format for the block at the end of each result: plain text stays as written, and tags in {'{{ }}'} fill in from each person’s reward lines and sheet.{' '}
        <a href="/docs/guide/results-board-rewards" target="_blank" rel="noreferrer" className="text-interactive-primary hover:underline">
          How rewards work, with every tag
        </a>
        .
      </p>
      {!settings.rewardTemplate.trim() && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setTemplate(STARTER.template);
            if (!settings.rewardGroups.length) {
              setGroups(STARTER.groups);
              setGroupsDraft(groupsText(STARTER.groups));
            }
          }}
        >
          Start from a simple template
        </Button>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Textarea id="reward-template-box" label="Template" rows={18} className="font-mono text-sm" value={settings.rewardTemplate} onChange={(e) => setTemplate(e.target.value)} data-testid="reward-template" />
          <Textarea
            id="reward-groups-box"
            label="Sections"
            helperText="One per line, key: Label. Reward lines belong to a section; {{lines key}} shows them."
            rows={4}
            className="font-mono text-sm"
            value={groupsDraft}
            onChange={(e) => {
              setGroupsDraft(e.target.value);
              setGroups(parseGroups(e.target.value));
            }}
            data-testid="reward-groups"
          />
          <Textarea
            id="reward-scales-box"
            label="Scales"
            helperText="One per line, Tab/Entry: 0 Name, 5.5 Name. {{label Tab/Entry}} shows the name for the current number."
            rows={3}
            className="font-mono text-sm"
            value={scalesDraft}
            onChange={(e) => {
              setScalesDraft(e.target.value);
              setScales(parseScales(e.target.value));
            }}
            data-testid="reward-scales"
          />
          <details>
            <summary className="cursor-pointer text-sm font-medium text-content-primary">Tags, in short</summary>
            <dl className="mt-2 space-y-1 text-sm">
              {TAGS.map(([tag, what]) => (
                <div key={tag}>
                  <dt className="inline font-mono text-content-primary">{tag}</dt> <dd className="inline text-content-secondary">{what}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Select id="reward-preview-who-box" label="Preview for" selectSize="sm" value={String(who)} onChange={(e) => setWho(Number(e.target.value))} data-testid="reward-preview-who">
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {phases.length > 0 && (
              <Select id="reward-preview-phase" label="In" selectSize="sm" value={String(phaseId)} onChange={(e) => setPhaseId(Number(e.target.value))}>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <pre className="min-h-[12rem] whitespace-pre-wrap rounded surface-sunken p-2 font-mono text-xs text-content-primary" data-testid="reward-preview">
            {preview.text || '(empty)'}
          </pre>
          {preview.problems.length > 0 && (
            <ul className="space-y-1 text-sm" data-testid="reward-template-problems">
              {preview.problems.map((p) => (
                <li key={p} className="flex items-baseline gap-1.5">
                  <Badge size="sm" variant="warning">
                    Block
                  </Badge>
                  <span className="text-content-primary">{p}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
