import { Button, Checkbox, Input } from '@/components/ui';
import { useBoundText } from '@/hooks/useBoundText';
import type { CastMember } from '@/lib/gmBoard/cast';
import { suggestClusters } from '@/lib/gmBoard/map';
import type { BoardDoc, Cluster } from '@/lib/gmBoard/types';
import { groupName } from './mapModel';

interface ClusterEditorProps {
  board: Pick<BoardDoc, 'cards' | 'scenes' | 'clusters'>;
  players: CastMember[];
  /** Saves a cluster's name and members (one cluster each: adding someone takes them out of any other). */
  onSave: (cluster: Cluster) => void;
  onRemove: (id: string) => void;
  onCreate: (name: string, characterIds: number[]) => void;
}

/**
 * Clusters: groups of players the GM works on together, so the Map can show
 * just one group. Suggestions are players who share a cell somewhere.
 */
export function ClusterEditor({ board, players, onSave, onRemove, onCreate }: ClusterEditorProps) {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((id) => b.includes(id));
  const suggestions = suggestClusters(board, players.map((p) => p.id)).filter(
    (g) => g.length > 1 && !board.clusters.some((c) => same(c.characterIds, g)),
  );

  const setMember = (cluster: Cluster, id: number, on: boolean) => {
    if (on) {
      for (const other of board.clusters) {
        if (other.id !== cluster.id && other.characterIds.includes(id)) onSave({ ...other, characterIds: other.characterIds.filter((x) => x !== id) });
      }
    }
    onSave({ ...cluster, characterIds: on ? [...cluster.characterIds, id] : cluster.characterIds.filter((x) => x !== id) });
  };

  return (
    <div className="space-y-6 p-4" data-testid="cluster-editor">
      {suggestions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-content-primary">Groups that share a cell</h3>
          <ul className="space-y-1">
            {suggestions.map((g) => (
              <li key={g.join('-')} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-content-primary">{groupName(g, players)}</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => onCreate(groupName(g, players), g)}>
                  Make cluster
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {board.clusters.map((cluster) => (
        <ClusterRow
          key={cluster.id}
          cluster={cluster}
          players={players}
          onRename={(name) => onSave({ ...cluster, name })}
          onToggle={(id, on) => setMember(cluster, id, on)}
          onRemove={() => onRemove(cluster.id)}
        />
      ))}

      <Button type="button" variant="secondary" onClick={() => onCreate(`Cluster ${board.clusters.length + 1}`, [])}>
        + New cluster
      </Button>
    </div>
  );
}

interface ClusterRowProps {
  cluster: Cluster;
  players: CastMember[];
  onRename: (name: string) => void;
  onToggle: (id: number, on: boolean) => void;
  onRemove: () => void;
}

function ClusterRow({ cluster, players, onRename, onToggle, onRemove }: ClusterRowProps) {
  const name = useBoundText(cluster.name);
  return (
    <section className="space-y-2 rounded-lg border border-theme-default p-3" aria-label={`Cluster ${cluster.name}`}>
      <div className="flex items-end gap-2">
        <Input
          id={`cluster-${cluster.id}-name`}
          label="Name"
          value={name.text}
          {...name.bind}
          onChange={(e) => {
            name.setText(e.target.value);
            onRename(e.target.value);
          }}
        />
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Delete the cluster ${cluster.name}`}>
          Delete
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {players.map((p) => (
          <Checkbox
            key={p.id}
            id={`cluster-${cluster.id}-${p.id}`}
            label={p.name}
            checked={cluster.characterIds.includes(p.id)}
            onChange={(e) => onToggle(p.id, e.target.checked)}
          />
        ))}
      </div>
    </section>
  );
}
