import { Spinner, Toggle } from '@/components/ui';
import { useBoardReadOnly } from '@/hooks/useBoardReadOnly';
import { useGmSettings, useGmSettingsStore } from '@/hooks/useGmBoard';

/** The `prefs` settings item's key: one per game. */
const PREFS_KEY = 'prefs';

/** Game-wide board preferences. Today: second person ("Make 'you'"), on by default. */
export function GmBoardPrefs({ gameId }: { gameId: number }) {
  const { settings, isLoading } = useGmSettings(gameId);
  const store = useGmSettingsStore(gameId);
  const readOnly = useBoardReadOnly();
  if (isLoading || !settings) return <Spinner />;
  return (
    <Toggle
      label="Moments read as “you”"
      description="Each reader’s copy of a moment swaps their names for “you” and fixes the verb after them, and Write offers Make “you” for drafts. Turn it off for a game written in third person."
      checked={settings.secondPerson}
      disabled={readOnly}
      onChange={(on) => store.update<{ secondPerson: boolean }>('prefs', PREFS_KEY, (doc) => ({ ...doc, secondPerson: on }))}
      data-testid="gm-pref-second-person"
    />
  );
}
