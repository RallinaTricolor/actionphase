import { trackVisual, type TrackValue } from '@/lib/sheetEntries';

/**
 * A bounded value drawn as filled/empty boxes — the notation most narrative
 * systems use for stress, harm, and clocks.
 *
 * trackVisual falls back to a bar past MAX_RENDERED_BOXES: twenty is already a wide row on a
 * phone, and a hundred boxes is unreadable rather than merely long.
 */
const BoxTrack: React.FC<{ filled: number; total: number; label: string }> = ({ filled, total, label }) => (
  <div className="flex items-center gap-1 flex-wrap" role="img" aria-label={`${label}: ${filled} of ${total}`}>
    {Array.from({ length: total }, (_, i) => (
      <span
        key={i}
        className={`inline-block w-4 h-4 rounded-sm border ${
          i < filled ? 'bg-interactive-primary border-interactive-primary' : 'border-theme-default'
        }`}
      />
    ))}
  </div>
);

const BarTrack: React.FC<{ filled: number; total: number; label: string }> = ({ filled, total, label }) => {
  // Clamped because a value can exceed its maximum — overfilled stress is a
  // real state in several systems, and a 140%-wide bar would break the layout.
  const percent = Math.min(100, Math.max(0, (filled / total) * 100));
  return (
    <div
      // Bordered like BoxTrack's empty cells: without an outline the trough
      // blends into the card and the bar's full extent — and so the value it
      // encodes — is unreadable at anything under a full fill.
      className="w-full h-2 rounded-full surface-secondary border border-theme-default overflow-hidden"
      role="img"
      aria-label={`${label}: ${filled} of ${total}`}
    >
      <div className="h-full bg-interactive-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
};

/**
 * A `track` field on an entry card: its label and "value / max", with a bar or
 * boxes underneath when the track is bounded and asks for one.
 *
 * The drawn track's accessible name leads with the entry's name: the field
 * label alone repeats on every entry ("Amount: 4 of 9"), which says nothing
 * about which entry it belongs to.
 */
export const TrackDisplay: React.FC<{ label: string; entryName?: string; track: TrackValue }> = ({
  label,
  entryName,
  track,
}) => {
  const visual = trackVisual(track);
  const max = track.max ?? 0;
  const accessibleLabel = entryName ? `${entryName}, ${label}` : label;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-content-secondary">{label}</span>
        <span className="font-semibold text-semantic-success">
          {track.value.toLocaleString()}
          {track.max !== undefined && (
            <span className="text-content-tertiary font-normal"> / {track.max.toLocaleString()}</span>
          )}
        </span>
      </div>
      {visual !== 'number' && (
        <div className="mt-1">
          {visual === 'boxes' ? (
            <BoxTrack filled={track.value} total={max} label={accessibleLabel} />
          ) : (
            <BarTrack filled={track.value} total={max} label={accessibleLabel} />
          )}
        </div>
      )}
    </div>
  );
};
