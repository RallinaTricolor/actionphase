import type { ReactNode } from 'react';
import { Badge, Button, Select } from '@/components/ui';
import { cardLabel, isIF } from '@/lib/gmBoard/cards';
import { codexTone } from '@/lib/gmBoard/codex';
import type { SubmissionLinks } from '@/lib/gmBoard/read';
import { STANCES, stanceOf } from '@/lib/gmBoard/stances';
import { truncate } from '@/lib/gmBoard/text';
import type { BoardDoc, Card, Chunk, CodexEntry, StanceValue } from '@/lib/gmBoard/types';

interface ReadSidebarProps {
  ownerId: number;
  /** characterId → name, for everyone the board knows. */
  names: Map<number, string>;
  /** The phase's other submitters, for stances. */
  submitters: number[];
  stances: BoardDoc['stances'];
  cards: Card[];
  chunks: Chunk[];
  codex: CodexEntry[];
  links: SubmissionLinks;
  readOnly?: boolean;
  onSetStance: (from: number, to: number, value: StanceValue | '') => void;
  onOpenCard: (cardId: string) => void;
  onPickSubmission: (characterId: number) => void;
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
      {children}
    </section>
  );
}

const None = ({ children }: { children: ReactNode }) => <p className="text-sm text-content-tertiary">{children}</p>;

/**
 * Beside a submission: what its owner intends toward the others (stances),
 * the cards it has given the board, and who it connects to: people it names,
 * people who name its owner, and people in the same place who name neither.
 */
export function ReadSidebar({
  ownerId,
  names,
  submitters,
  stances,
  cards,
  chunks,
  codex,
  links,
  readOnly = false,
  onSetStance,
  onOpenCard,
  onPickSubmission,
}: ReadSidebarProps) {
  const nameOf = (id: number) => names.get(id) ?? `Character ${id}`;
  const owner = nameOf(ownerId);
  const chunkIndex = new Map([...chunks].sort((a, b) => a.position - b.position).map((c, i) => [c.id, i]));
  const chunkName = (id: string | null) => (id === null ? 'Contingencies' : (chunks.find((c) => c.id === id)?.name ?? 'No time slot'));
  const entry = new Map(codex.map((e) => [e.id, e]));
  const myCards = cards
    .filter((c) => c.characterId === ownerId)
    .sort((a, b) => (chunkIndex.get(a.chunkId ?? '') ?? -1) - (chunkIndex.get(b.chunkId ?? '') ?? -1));
  const others = submitters.filter((id) => id !== ownerId);
  const named = new Set(links.mentions);
  const stanceList = [...others.filter((id) => named.has(id)), ...others.filter((id) => !named.has(id))];
  const canRead = new Set(submitters);
  const person = (id: number) =>
    canRead.has(id) ? (
      <Button type="button" variant="ghost" size="sm" className="!px-1" onClick={() => onPickSubmission(id)}>
        {nameOf(id)}
      </Button>
    ) : (
      <span className="text-sm text-content-primary px-1">{nameOf(id)}</span>
    );

  return (
    <aside className="space-y-6" aria-label="About this submission" data-testid="read-sidebar">
      <Section title={<>Stances <span className="font-normal text-content-tertiary">· what {owner} intends</span></>}>
        {stanceList.length === 0 ? (
          <None>No one else submitted.</None>
        ) : (
          <div className="space-y-2">
            {stanceList.map((id) => {
              const mine = stanceOf(stances, ownerId, id);
              const back = stanceOf(stances, id, ownerId);
              const backLabel = back && STANCES.find((s) => s.value === back.value)?.label;
              return (
                <div key={id} className="grid grid-cols-[1fr_9rem] items-center gap-2">
                  <div className="min-w-0 text-sm">
                    <span className="text-content-primary">{nameOf(id)}</span>
                    {named.has(id) && (
                      <Badge variant="primary" size="sm" className="ml-1">
                        named
                      </Badge>
                    )}
                    {backLabel && <span className="block text-xs text-content-tertiary">{backLabel} back</span>}
                  </div>
                  <Select
                    id={`stance-${ownerId}-${id}`}
                    aria-label={`${owner} toward ${nameOf(id)}`}
                    selectSize="sm"
                    value={mine?.value ?? ''}
                    disabled={readOnly}
                    onChange={(e) => onSetStance(ownerId, id, e.target.value as StanceValue | '')}
                  >
                    <option value="">Not set</option>
                    {STANCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
            <p className="text-xs text-content-tertiary">“named”: in this submission. “back”: their stance toward {owner}.</p>
          </div>
        )}
      </Section>

      <Section title={`Board cards (${myCards.length})`}>
        {myCards.length === 0 ? (
          <None>No cards yet.</None>
        ) : (
          <ul className="space-y-1">
            {myCards.map((c) => (
              <li key={c.id}>
                <Button type="button" variant="ghost" size="sm" className="!px-1 text-left !justify-start w-full" onClick={() => onOpenCard(c.id)}>
                  <span className="min-w-0">
                    <span className="block truncate">
                      {isIF(c) && (
                        <Badge variant="primary" size="sm" className="mr-1">
                          IF
                        </Badge>
                      )}
                      {truncate(cardLabel(c), 70)}
                    </span>
                    <span className="block text-xs text-content-tertiary">
                      {entry.get(c.locationId)?.name ?? 'No location'} · {chunkName(c.chunkId)}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Names (${links.mentions.length})`}>
        {links.mentions.length ? <div className="flex flex-wrap gap-1">{links.mentions.map((id) => <span key={id}>{person(id)}</span>)}</div> : <None>Names nobody.</None>}
      </Section>

      <Section title={`Named by (${links.mentionedBy.length})`}>
        {links.mentionedBy.length ? (
          <div className="flex flex-wrap gap-1">{links.mentionedBy.map((id) => <span key={id}>{person(id)}</span>)}</div>
        ) : (
          <None>Nobody else names {owner}.</None>
        )}
      </Section>

      <Section title="Same place, not named">
        {!codex.some((e) => e.type === 'Location') ? (
          <None>Add locations to the codex to find these.</None>
        ) : links.samePlace.length ? (
          <ul className="space-y-1">
            {links.samePlace.map((s) => (
              <li key={s.characterId}>
                {person(s.characterId)}
                <span className="block px-1 text-xs text-content-tertiary">
                  also names {s.locationIds.map((id) => entry.get(id)?.name ?? id).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <None>No one else names the same places.</None>
        )}
      </Section>

      <Section title="Codex matches">
        {links.codexIds.length ? (
          <ul className="space-y-2">
            {links.codexIds.map((id) => {
              const e = entry.get(id);
              if (!e) return null;
              return (
                <li key={id} className="text-sm">
                  <Badge variant={codexTone(e)} size="sm" className="mr-1">
                    {e.type}
                  </Badge>
                  <span className="text-content-primary">{e.name}</span>
                  {e.notes && <span className="block text-xs text-content-secondary">{truncate(e.notes, 160)}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <None>{codex.length ? 'No codex names in this submission.' : 'The codex is empty.'}</None>
        )}
      </Section>
    </aside>
  );
}
