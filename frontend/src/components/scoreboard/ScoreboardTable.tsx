import { EyeOff } from 'lucide-react';
import { Card } from '@/components/ui';
import CharacterAvatar from '@/components/characters/CharacterAvatar';
import { CharacterNameLink } from '@/components/characters/CharacterNameLink';
import { formatScoreboardCell } from '@/lib/scoreboardFormat';
import { ScoreboardLabel } from './ScoreboardLabel';
import type { Scoreboard, ScoreboardDisplay } from '@/types/scoreboard';

const HIDDEN_FROM_PLAYERS = 'Hidden from players';

// Borders go on the cells, with the table's own collapsing off: a collapsed
// border belongs to the table, so it scrolls away from a sticky cell.
// Padding is !important because index.css shrinks anything with a surface-*
// class to 5px on phones, which would pull headings out of line with their cells.
const HEADER_CELL = 'surface-raised border-b border-theme-default !py-2 font-medium';
const BODY_CELL = 'border-b border-theme-default !py-2 group-last:border-b-0';

// A line between value columns: a right-aligned number would otherwise run
// into a left-aligned label beside it. The first sits against the name
// column's own border.
const columnDivider = (index: number) => (index > 0 ? 'border-l' : '');

// Numbers line up on the right; range labels read as text.
const cellAlignment = (display: ScoreboardDisplay) =>
  display === 'bands' ? 'text-left' : 'text-right tabular-nums';

/**
 * The board as a table. Position is simply the row's place in the server's
 * order, so tied characters get consecutive numbers and nothing marks a tie:
 * on a board sorted by a hidden column, a tie would give that column away.
 *
 * The position and name columns stay put while the values scroll sideways.
 */
export function ScoreboardTable({ board }: { board: Scoreboard }) {
  const columns = board.columns ?? [];
  const rows = board.rows ?? [];
  const hasHiddenColumn = columns.some((column) => column.hidden);

  return (
    <div className="space-y-2">
      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm" data-testid="scoreboard-table">
            <caption className="sr-only">Scoreboard</caption>
            <thead>
              <tr className="text-xs text-content-secondary">
                <th scope="col" className={`${HEADER_CELL} sticky left-0 z-10 w-10 min-w-10 !px-2 text-right`}>
                  <span aria-hidden="true">#</span>
                  <span className="sr-only">Position</span>
                </th>
                <th scope="col" className={`${HEADER_CELL} sticky left-10 z-10 border-r !px-3 text-left`}>
                  Character
                </th>
                {columns.map((column, columnIndex) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={`${HEADER_CELL} whitespace-nowrap !px-3 ${columnDivider(columnIndex)} ${cellAlignment(column.display)}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column.label}
                      {column.hidden && (
                        <span role="img" aria-label={HIDDEN_FROM_PLAYERS} title={HIDDEN_FROM_PLAYERS}>
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.character_id} className="group" data-testid="scoreboard-row">
                  <td className={`${BODY_CELL} surface-base sticky left-0 z-10 w-10 min-w-10 !px-2 text-right tabular-nums text-content-tertiary`}>
                    {index + 1}
                  </td>
                  <th scope="row" className={`${BODY_CELL} surface-base sticky left-10 z-10 max-w-40 border-r !px-3 text-left font-medium text-content-primary sm:max-w-none`}>
                    <span className="flex min-w-0 items-center gap-2">
                      <CharacterAvatar avatarUrl={row.avatar_url} characterName={row.character_name} size="xs" className="shrink-0" />
                      <span className="min-w-0 truncate">
                        <CharacterNameLink
                          characterId={row.character_id}
                          name={row.character_name}
                          data-testid="scoreboard-character-name"
                        />
                      </span>
                    </span>
                  </th>
                  {columns.map((column, columnIndex) => {
                    const cell = row.values[column.id];
                    return (
                      <td
                        key={column.id}
                        className={`${BODY_CELL} whitespace-nowrap !px-3 text-content-primary ${columnDivider(columnIndex)} ${cellAlignment(column.display)}`}
                      >
                        {column.display === 'bands' && cell?.label ? (
                          <>
                            <ScoreboardLabel text={cell.label} />
                            {cell.value !== undefined && ` (${cell.value})`}
                          </>
                        ) : formatScoreboardCell(cell, column.display)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {hasHiddenColumn && (
        <p className="flex items-center gap-1 text-xs text-content-tertiary">
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          {HIDDEN_FROM_PLAYERS}
        </p>
      )}
    </div>
  );
}
