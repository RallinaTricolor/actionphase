import { Select } from '@/components/ui';
import { SCOREBOARD_SORT_BY_NAME } from '@/lib/scoreboardEditing';
import type { ScoreboardColumn, ScoreboardSort } from '@/types/scoreboard';

interface ScoreboardSortFieldsProps {
  columns: readonly ScoreboardColumn[];
  sort: readonly ScoreboardSort[];
  onChange: (sort: ScoreboardSort[]) => void;
}

type Direction = ScoreboardSort['direction'];

const NO_SECOND_KEY = '';

/** Names read best from A; numbers are usually a ranking, highest first. */
const startingDirection = (key: string): Direction => (key === SCOREBOARD_SORT_BY_NAME ? 'asc' : 'desc');

const columnName = (column: ScoreboardColumn) => column.label.trim() || column.entry;

interface SortKeyFieldsProps {
  keyLabel: string;
  directionLabel: string;
  value: string;
  direction: Direction | undefined;
  options: { value: string; label: string }[];
  onKeyChange: (key: string) => void;
  onDirectionChange: (direction: Direction) => void;
}

function SortKeyFields({
  keyLabel,
  directionLabel,
  value,
  direction,
  options,
  onKeyChange,
  onDirectionChange,
}: SortKeyFieldsProps) {
  const isName = value === SCOREBOARD_SORT_BY_NAME;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select label={keyLabel} selectSize="sm" value={value} onChange={(e) => onKeyChange(e.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </Select>
      {direction && (
        <Select
          label={directionLabel}
          selectSize="sm"
          value={direction}
          onChange={(e) => onDirectionChange(e.target.value as Direction)}
        >
          <option value="asc">{isName ? 'A to Z' : 'Low to high'}</option>
          <option value="desc">{isName ? 'Z to A' : 'High to low'}</option>
        </Select>
      )}
    </div>
  );
}

/**
 * The board's order: one key, and optionally a second to break its ties. The
 * server breaks anything left by name, so a tie is never arbitrary.
 */
export function ScoreboardSortFields({ columns, sort, onChange }: ScoreboardSortFieldsProps) {
  const primary = sort[0] ?? { key: SCOREBOARD_SORT_BY_NAME, direction: 'asc' as const };
  const secondary = sort[1];

  const keyOptions = [
    { value: SCOREBOARD_SORT_BY_NAME, label: 'Name' },
    ...columns.map((column) => ({
      value: column.id,
      label: column.hidden ? `${columnName(column)} (hidden)` : columnName(column),
    })),
  ];

  const setPrimaryKey = (key: string) => {
    const next: ScoreboardSort[] = [{ key, direction: startingDirection(key) }];
    if (secondary && secondary.key !== key) next.push(secondary);
    onChange(next);
  };

  const primaryColumn = columns.find((column) => column.id === primary.key);
  const showsRangesInOrder = [primary, secondary]
    .map((key) => columns.find((column) => column.id === key?.key))
    .some((column) => column?.display === 'bands' && !column.hidden);

  return (
    <div className="space-y-3">
      <SortKeyFields
        keyLabel="Sort by"
        directionLabel="Order"
        value={primary.key}
        direction={primary.direction}
        options={keyOptions}
        onKeyChange={setPrimaryKey}
        onDirectionChange={(direction) => onChange([{ ...primary, direction }, ...(secondary ? [secondary] : [])])}
      />
      <SortKeyFields
        keyLabel="Then by"
        directionLabel="Then order"
        value={secondary?.key ?? NO_SECOND_KEY}
        direction={secondary?.direction}
        options={[
          { value: NO_SECOND_KEY, label: 'Nothing else' },
          ...keyOptions.filter((option) => option.value !== primary.key),
        ]}
        onKeyChange={(key) => onChange(
          key === NO_SECOND_KEY ? [primary] : [primary, { key, direction: startingDirection(key) }],
        )}
        onDirectionChange={(direction) => secondary && onChange([primary, { ...secondary, direction }])}
      />
      {primaryColumn?.hidden && (
        <p className="text-sm text-content-secondary" data-testid="scoreboard-sort-hidden-note">
          Players see the order and “Ranked by the GM”, but not what it is based on.
        </p>
      )}
      {showsRangesInOrder && (
        <p className="text-sm text-content-secondary" data-testid="scoreboard-sort-ranges-note">
          Ranges sort by the number behind them, so players can work out who is ahead within a range.
          To show only the range, sort by something else.
        </p>
      )}
    </div>
  );
}
