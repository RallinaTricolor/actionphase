import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Select, Textarea } from '@/components/ui';
import { useBoardRewards } from './boardRewards';
import { RewardLineEditor, GroupBadge } from './RewardEditors';
import { lineEffect, lineText, needsEntry, findEntry, keepLine, syncLine, driftedItem } from '@/lib/gmBoard/rewards';
import { defaultGroup, type RewardState } from '@/lib/gmBoard/rewardState';
import { boardSetupPath } from '@/lib/gmBoard/steps';
import type { ResultChain } from '@/lib/gmBoard/results';
import { truncate } from '@/lib/gmBoard/text';
import type { RewardItem, RewardLine } from '@/lib/gmBoard/types';

interface WriteRewardsProps {
  gameId: number;
  characterId: number;
  /** Short name, for sentences. */
  name: string;
  /** Full name, for the line editor's title. */
  fullName: string;
  state: RewardState;
  /** The character's results, to pick which one carries the sheet changes. */
  chains: ResultChain[];
  /** Scene id → its name, for lines made from a scene. */
  sceneName: (sceneId: string) => string | undefined;
  onPutBlock: () => void;
  putting: boolean;
  onCopy: (text: string) => void;
  onShowTable: () => void;
}

/**
 * A character's rewards in Write: their lines, quick-give chips from the
 * lists, the text slots, the block (put into their result), and their sheet
 * before and after. The sheet changes are saved as draft sheet updates on the
 * result that carries them, as the lines change.
 */
export function WriteRewards({ gameId, characterId, name, fullName, state, chains, sceneName, onPutBlock, putting, onCopy, onShowTable }: WriteRewardsProps) {
  const rewards = useBoardRewards();
  const { layout, groups, gameItems, phaseItems, items } = rewards;
  const [editing, setEditing] = useState<string | null>(null);
  const sync = rewards.syncFor(characterId);
  const { lines, locked, carrier } = state;
  const given = new Set(lines.map((l) => l.itemId).filter(Boolean));
  const editingLine = lines.find((l) => l.id === editing) ?? null;
  const entryNames = (tabKey: string) => (state.sheet.before[tabKey] ?? []).map((e) => e.name);

  const give = (item: RewardItem) => {
    const id = rewards.giveItem(characterId, item);
    if (needsEntry(item.ops)) setEditing(id);
  };
  const addLine = () => setEditing(rewards.addLine(characterId, { group: defaultGroup(groups), text: '', ops: [], choose: false }));

  const draftChains = chains.filter((c) => !c.head.is_published);
  // By head id: the state builds its own copy of the chains.
  const chainLabel = (c: ResultChain) => `Result ${chains.findIndex((x) => x.head.id === c.head.id) + 1}${c.parts.length > 1 ? `, part ${c.parts.length}` : ''}`;
  const chooseLater = lines.filter((l) => l.choose);

  const chip = (item: RewardItem) => (
    <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => give(item)} title={truncate(item.text, 200)} data-testid={`give-${item.id}`}>
      + {item.name || 'Unnamed'}
    </Button>
  );
  const quickGame = gameItems.filter((i) => !given.has(i.id));
  const quickPhase = phaseItems.filter((i) => !given.has(i.id));

  return (
    <div className="space-y-4" data-testid="write-rewards">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-content-primary">Rewards</h3>
          <span className="text-sm text-content-tertiary">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <div className="flex gap-2">
          {!locked && (
            <Button type="button" size="sm" variant="secondary" onClick={addLine}>
              + Line
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={onShowTable}>
            Rewards table
          </Button>
        </div>
      </div>

      {locked && (
        <Alert variant="info" data-testid="rewards-locked">
          {carrier.state === 'applied'
            ? `These went out with ${carrier.chain ? chainLabel(carrier.chain) : 'the result'}, and the sheet changes are applied.`
            : `These went out with ${carrier.chain ? chainLabel(carrier.chain) : 'the result'}. The sheet changes apply when its last part is revealed.`}
        </Alert>
      )}

      <ul className="space-y-2" data-testid="reward-lines">
        {lines.length === 0 && <li className="text-sm text-content-secondary">No rewards yet. Give one from the lists below, or add a line.</li>}
        {lines.map((line) => {
          const text = lineText(line, state.sheet.recs[line.id]);
          const effect = lineEffect(layout, line);
          const drift = driftedItem(line, items);
          return (
            <li key={line.id} className="rounded border border-theme-default p-2" data-testid={`reward-line-${line.id}`}>
              <div className="flex items-start gap-2">
                <GroupBadge groups={groups} group={line.group} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-content-primary">{text.trim() ? truncate(text, 110) : <span className="text-content-tertiary">(sheet only, nothing in the block)</span>}</p>
                  {effect && <p className={line.choose ? 'text-semantic-warning' : 'text-content-tertiary'}>{effect}</p>}
                  {line.quote && <p className="text-content-tertiary">because “{truncate(line.quote, 70)}”</p>}
                  {line.sceneId && <p className="text-content-tertiary">from {sceneName(line.sceneId) ?? 'a deleted scene'}</p>}
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(line.id)}>
                  {locked ? 'View' : 'Edit'}
                </Button>
                {!locked && (
                  <Button type="button" size="sm" variant="ghost" aria-label={`Remove ${truncate(text || 'this line', 30)}`} onClick={() => rewards.removeLine(characterId, line.id)}>
                    ✕
                  </Button>
                )}
              </div>
              {drift && !locked && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge size="sm" variant="warning">
                    Differs from the list
                  </Badge>
                  <span className="text-content-secondary">{drift.name} was changed in the list after you gave it.</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => rewards.updateLine(characterId, line.id, (l) => syncLine(l, drift))}>
                    Use the list’s version
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => rewards.updateLine(characterId, line.id, (l) => keepLine(l, drift))}>
                    Keep mine
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!locked &&
        (items.length ? (
          <div className="space-y-2" data-testid="reward-quick-give">
            {quickGame.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-content-tertiary">Every phase</p>
                <div className="flex flex-wrap gap-2">{quickGame.map(chip)}</div>
              </div>
            )}
            {quickPhase.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-content-tertiary">This phase</p>
                <div className="flex flex-wrap gap-2">{quickPhase.map(chip)}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-content-secondary">
            No reward lists yet. <Link to={boardSetupPath(gameId)} className="text-interactive-primary hover:underline">Make them on Game setup</Link>.
          </p>
        ))}

      {state.slots.map((slot) => (
        <Textarea
          key={slot}
          id={`reward-slot-box-${slot.replace(/\W+/g, '-')}`}
          label={slot}
          rows={2}
          value={state.rewards.texts[slot] ?? ''}
          disabled={locked}
          onChange={(e) => rewards.updateRewards(characterId, (r) => ({ ...r, texts: { ...r.texts, [slot]: e.target.value } }))}
          data-testid={`reward-slot-${slot}`}
        />
      ))}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-content-primary">Reward block</h4>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={!state.block.text} onClick={() => onCopy(state.block.text)}>
              Copy block
            </Button>
            {!locked && (
              <Button
                type="button"
                size="sm"
                variant="primary"
                disabled={!state.block.text || !carrier.tail || putting}
                onClick={onPutBlock}
                title={carrier.tail ? `Put the block at the end of ${carrier.chain ? chainLabel(carrier.chain) : 'the result'}, replacing the copy put there last time` : `${name} has no draft result yet`}
                data-testid="put-block"
              >
                Put block in result
              </Button>
            )}
          </div>
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded surface-sunken p-2 font-mono text-xs text-content-primary" data-testid="reward-block">
          {state.block.text || '(empty: no lines with text yet)'}
        </pre>
      </section>

      <section className="space-y-2" data-testid="reward-sheet">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-content-primary">
            Sheet changes <span className="font-normal text-content-tertiary">{state.changes ? `${state.changes} in ${state.diff.map((d) => d.tab.label).join(', ')}` : 'none'}</span>
          </h4>
          {!locked && draftChains.length > 1 ? (
            <Select
              aria-label="Result that carries the sheet changes"
              selectSize="sm"
              value={String(carrier.chain?.head.id ?? '')}
              onChange={(e) => rewards.updateRewards(characterId, (r) => ({ ...r, carrierHeadId: Number(e.target.value) }))}
              data-testid="reward-carrier"
            >
              {draftChains.map((c) => (
                <option key={c.head.id} value={c.head.id}>
                  On {chainLabel(c)}
                </option>
              ))}
            </Select>
          ) : (
            !locked &&
            carrier.chain &&
            state.changes > 0 && <span className="text-xs text-content-tertiary">On {chainLabel(carrier.chain)}</span>
          )}
        </div>
        {state.diff.length === 0 ? (
          <p className="text-sm text-content-secondary">No sheet changes yet.</p>
        ) : (
          state.diff.map((d) => (
            <div key={d.tab.key} className="text-sm">
              <p className="font-medium text-content-primary">{d.tab.label}</p>
              {d.rows.map((r, i) => (
                <p key={i} className="text-content-secondary">
                  {r.kind === 'add' ? (
                    <span className="text-semantic-success">+ {r.name}</span>
                  ) : r.kind === 'remove' ? (
                    <span className="text-semantic-danger">− {r.name}</span>
                  ) : (
                    <>
                      {r.name}:{' '}
                      {r.fields.map((f, j) => (
                        <span key={f.key}>
                          {j > 0 && ', '}
                          {f.label} {f.before} → <strong className="text-content-primary">{f.after}</strong>
                        </span>
                      ))}
                    </>
                  )}
                </p>
              ))}
            </div>
          ))
        )}
        {chooseLater.length > 0 && (
          <p className="text-sm text-semantic-warning">
            Not on the sheet: {chooseLater.map((l) => truncate(l.text.split('\n')[0] || 'a Choose 1 reward', 40)).join('; ')}. {name} chooses after the result is out;
            update their sheet then.
          </p>
        )}
        {!locked && state.changes > 0 && <SyncLine sync={sync} onReplace={() => rewards.replaceHandMade(characterId)} noResult={carrier.state === 'no-result'} name={name} staged={(carrier.chain?.parts.length ?? 0) > 1} />}
      </section>

      <RewardLineEditor
        line={editingLine}
        onClose={() => setEditing(null)}
        characterName={fullName}
        item={editingLine?.itemId ? items.find((i) => i.id === editingLine.itemId) : undefined}
        sceneName={editingLine?.sceneId ? sceneName(editingLine.sceneId) : undefined}
        groups={groups}
        layout={layout}
        entryNames={entryNames}
        locked={locked}
        onChange={(line: RewardLine) => rewards.updateLine(characterId, line.id, () => fixEntryCase(line, state))}
        onRemove={() => {
          if (editingLine) rewards.removeLine(characterId, editingLine.id);
          setEditing(null);
        }}
        onAddToList={
          editingLine
            ? () => {
                const id = `rw${editingLine.id}`;
                const item: RewardItem = { id, scope: 'phase', name: truncate(editingLine.text.split('\n')[0] || 'New reward', 40), group: editingLine.group, text: editingLine.text, ops: editingLine.ops, choose: editingLine.choose, position: phaseItems.length + 1 };
                rewards.saveItem(item);
                rewards.updateLine(characterId, editingLine.id, (l) => syncLine(l, item));
              }
            : undefined
        }
      />
    </div>
  );
}

/** Capitals fixed to match an entry on the character's sheet. */
function fixEntryCase(line: RewardLine, state: RewardState): RewardLine {
  return {
    ...line,
    ops: line.ops.map((op) => {
      if (op.act === 'add') return op;
      const match = findEntry(state.sheet.before[op.tab] ?? [], op.entry);
      return match ? { ...op, entry: match.name } : op;
    }),
  };
}

function SyncLine({ sync, onReplace, noResult, name, staged }: { sync: ReturnType<ReturnType<typeof useBoardRewards>['syncFor']>; onReplace: () => void; noResult: boolean; name: string; staged: boolean }) {
  if (noResult) return <p className="text-sm text-content-secondary">These are saved to the sheet once {name} has a draft result to carry them.</p>;
  if (sync.state === 'hand-made')
    return (
      <Alert variant="warning" title="Sheet updates made by hand" data-testid="reward-hand-made">
        <p className="text-sm">
          {name} already has sheet updates from the results list ({[...new Set(sync.handMade.map((d) => d.module_type))].join(', ')}). They’re whole-tab copies, so these
          rewards would overwrite them. Replace them with the ones worked out here?
        </p>
        <Button type="button" size="sm" variant="primary" className="mt-2" onClick={onReplace}>
          Replace them
        </Button>
      </Alert>
    );
  if (sync.state === 'error')
    return (
      <Alert variant="danger" data-testid="reward-sync-error">
        Couldn’t save the sheet updates{sync.message ? `: ${sync.message}` : ''}. It’ll try again when something changes.
      </Alert>
    );
  return (
    <p className="text-xs text-content-tertiary" data-testid="reward-sync">
      {sync.state === 'syncing'
        ? 'Saving the sheet updates…'
        : staged
          ? 'Saved as draft sheet updates: they apply when the last part is revealed.'
          : 'Saved as draft sheet updates: they apply when the result is published.'}
    </p>
  );
}
