import { useState, type ComponentProps } from 'react';
import { Badge, Button, Input } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import type { SheetItem } from '@/hooks/useCharacterSheetItems';
import { codexTone } from '@/lib/gmBoard/codex';
import type { NamedCharacter } from '@/lib/gmBoard/read';
import { plainText, shortName, termIn, truncate } from '@/lib/gmBoard/text';
import type { CodexEntry } from '@/lib/gmBoard/types';
import { ScenePlans } from './ScenePlans';
import type { SceneModel } from './sceneTypes';
import { SubmissionReader } from './SubmissionReader';

const TABS = [
  { id: 'plans', label: 'Plans' },
  { id: 'submission', label: 'Submission' },
  { id: 'sheet', label: 'Sheet' },
  { id: 'codex', label: 'Codex' },
] as const;
type Tab = (typeof TABS)[number]['id'];

interface SceneReferenceProps {
  model: SceneModel;
  plans: Omit<ComponentProps<typeof ScenePlans>, 'model'>;
  submissions: Map<number, string>;
  sheetItems: Map<number, SheetItem[]>;
  /** This phase's codex entries. */
  codex: CodexEntry[];
  characters: NamedCharacter[];
  /** Puts text at the cursor in the last moment box the GM was in. */
  onInsert: (text: string) => void;
  onMomentFromPassage: (characterId: number, text: string) => void;
}

/** The left pane of the Scenes step: what the GM writes from. Plans, a submission, a sheet, or the codex. */
export function SceneReference({ model, plans, submissions, sheetItems, codex, characters, onInsert, onMomentFromPassage }: SceneReferenceProps) {
  const [tab, setTab] = useState<Tab>('plans');
  const [who, setWho] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const { scene } = model;

  const withSubmission = scene.participants.filter((id) => submissions.get(id)?.trim());
  const withSheet = scene.participants.filter((id) => (sheetItems.get(id) ?? []).length > 0);
  const pickFrom = tab === 'submission' ? withSubmission : withSheet;
  const owner = who !== null && pickFrom.includes(who) ? who : (pickFrom[0] ?? null);
  const q = query.trim().toLowerCase();

  const whoPicker = (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Whose">
      {pickFrom.map((id) => {
        const n = shortName(model.names.get(id) ?? `Character ${id}`);
        return (
          <Button key={id} type="button" size="sm" variant={id === owner ? 'primary' : 'secondary'} aria-pressed={id === owner} className="gap-1" onClick={() => setWho(id)}>
            <CharacterAvatar avatarUrl={model.cast.get(id)?.avatarUrl} characterName={n} size="xs" />
            {n}
          </Button>
        );
      })}
    </div>
  );

  let body;
  if (tab === 'plans') {
    body = <ScenePlans model={model} {...plans} />;
  } else if (tab === 'submission') {
    body =
      owner === null ? (
        <p className="text-sm text-content-secondary">Nobody in this scene has a submission this phase.</p>
      ) : (
        <div className="space-y-2">
          {whoPicker}
          <p className="text-xs text-content-tertiary">Select a passage for “→ Moment”, or use → beside a paragraph.</p>
          <SubmissionReader
            key={owner}
            ownerId={owner}
            text={submissions.get(owner) ?? ''}
            cards={model.board.cards}
            characters={characters}
            codex={codex}
            sheetItems={sheetItems.get(owner)}
            onAddMoment={(text) => onMomentFromPassage(owner, text)}
            onOpenCard={() => undefined}
          />
        </div>
      );
  } else if (tab === 'sheet') {
    const submission = owner === null ? '' : (submissions.get(owner) ?? '');
    const used = scene.moments.map((m) => [m.text, ...Object.values(m.ownText)].join(' ')).join(' ').toLowerCase();
    const items = (owner === null ? [] : (sheetItems.get(owner) ?? []))
      .map((it) => ({ it, planned: termIn(submission, it.name), used: used.includes(it.name.toLowerCase()), text: plainText(it.description ?? '') }))
      .filter(({ it, text }) => !q || it.name.toLowerCase().includes(q) || text.toLowerCase().includes(q))
      .sort((a, b) => Number(b.planned) - Number(a.planned) || a.it.name.localeCompare(b.it.name));
    body =
      owner === null ? (
        <p className="text-sm text-content-secondary">Nobody in this scene has a sheet.</p>
      ) : (
        <div className="space-y-2">
          {whoPicker}
          <Input id="scene-sheet-search" aria-label="Search the sheet" placeholder={`Search ${shortName(model.names.get(owner) ?? '')}’s sheet`} value={query} onChange={(e) => setQuery(e.target.value)} />
          <p className="text-xs text-content-tertiary">Insert puts the name in bold at your cursor. “In plan”: named in their submission. “Used”: already in a moment.</p>
          {items.length ? (
            items.map(({ it, planned, used: inScene, text }) => (
              <div key={it.id} className="space-y-0.5 rounded border border-theme-subtle p-2" data-testid={`sheet-item-${it.id}`}>
                <div className="flex items-center gap-1">
                  <span className="flex-1 font-medium text-content-primary">{it.name}</span>
                  {planned && (
                    <Badge variant="primary" size="sm">
                      in plan
                    </Badge>
                  )}
                  {inScene && (
                    <Badge variant="success" size="sm">
                      used
                    </Badge>
                  )}
                  <span className="text-xs text-content-tertiary">{it.tabLabel}</span>
                  <Button type="button" size="sm" variant="secondary" title={`Insert “${it.name}” in bold where your cursor was`} aria-label={`Insert ${it.name}`} onClick={() => onInsert(`**${it.name}**`)}>
                    Insert
                  </Button>
                </div>
                {text && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-content-tertiary">{truncate(text, 90)}</summary>
                    <p className="mt-1 whitespace-pre-wrap text-content-secondary">{text}</p>
                  </details>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-content-secondary">{q ? 'Nothing matches.' : 'Nothing on this sheet.'}</p>
          )}
        </div>
      );
  } else {
    const list = codex.filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)),
    );
    body = (
      <div className="space-y-2">
        <Input id="scene-codex-search" aria-label="Search the codex" placeholder="Search the codex" value={query} onChange={(e) => setQuery(e.target.value)} />
        {list.length ? (
          list.map((e) => (
            <div key={e.id} className="space-y-0.5 rounded border border-theme-subtle p-2">
              <div className="flex items-center gap-1">
                <Badge variant={codexTone(e)} size="sm">
                  {e.secret ? 'Secret' : e.type}
                </Badge>
                <span className="flex-1 font-medium text-content-primary">{e.name}</span>
                <Button type="button" size="sm" variant="secondary" aria-label={`Insert ${e.name}`} onClick={() => onInsert(e.name)}>
                  Insert
                </Button>
              </div>
              {e.notes && <p className="whitespace-pre-wrap text-xs text-content-secondary">{e.notes}</p>}
            </div>
          ))
        ) : (
          <p className="text-sm text-content-secondary">{codex.length ? 'Nothing matches.' : 'The codex is empty for this phase.'}</p>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Reference" className="space-y-3" data-testid="scene-reference">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Reference tab">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tab === t.id ? 'primary' : 'secondary'}
            aria-pressed={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setQuery('');
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {body}
    </section>
  );
}
