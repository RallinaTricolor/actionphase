import { Alert, Button } from '@/components/ui';
import type { DirtyEdit } from '@/lib/gmBoard/store';

interface GmBoardConflictsProps {
  lost: DirtyEdit[];
  onKeepMine: (edit: DirtyEdit) => void;
  onDismiss: () => void;
  /** Names for kinds that mean something else in this store (the game's notes, say). */
  kindNames?: Record<string, string>;
}

const KIND_NAMES: Record<string, string> = {
  card: 'a card',
  scene: 'a scene',
  chunk: 'a time slot',
  cluster: 'a cluster',
  stance: 'a stance',
  progress: 'a player’s progress',
  flag: 'a dismissed flag',
  notes: 'the notes',
  codex: 'a codex entry',
  names: 'a character’s names',
  template: 'the reward template',
  groups: 'the reward groups',
  scales: 'the scales',
  prefs: 'the board preferences',
  reward: 'a reward in a list',
  rewards: 'a character’s rewards',
};

/**
 * Edits that lost a race: another GM (or another tab) saved the same item
 * first. Their version is what the board now shows; "Use mine" puts this
 * tab's edit back on top of it.
 */
export function GmBoardConflicts({ lost, onKeepMine, onDismiss, kindNames }: GmBoardConflictsProps) {
  if (lost.length === 0) return null;
  return (
    <Alert variant="warning" title="Someone else changed what you were editing" dismissible onDismiss={onDismiss}>
      <p className="mb-2">The board now shows their version. Choose “Use mine” to put your change back.</p>
      <ul className="space-y-2">
        {lost.map((edit) => (
          <li key={`${edit.kind}/${edit.key}`} className="flex items-center gap-3">
            <span>
              {kindNames?.[edit.kind] ?? KIND_NAMES[edit.kind] ?? edit.kind}
              {edit.deleted ? ' (you deleted it)' : ''}
            </span>
            <Button type="button" size="sm" variant="secondary" onClick={() => onKeepMine(edit)}>
              Use mine
            </Button>
          </li>
        ))}
      </ul>
    </Alert>
  );
}
