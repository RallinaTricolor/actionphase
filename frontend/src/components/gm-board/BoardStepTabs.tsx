import { useMemo } from 'react';
import { TabNavigation } from '@/components/layout/TabNavigation';
import { useGameActionResults } from '@/hooks/useActionResults';
import { useBoardPeople } from '@/hooks/useBoardPeople';
import { stepProgress } from '@/lib/gmBoard/progress';
import { characterIdsWithResults, writeList } from '@/lib/gmBoard/results';
import { BOARD_STEPS, boardPath, parseBoardStep, type BoardStep } from '@/lib/gmBoard/steps';
import type { BoardDoc } from '@/lib/gmBoard/types';

interface BoardStepTabsProps {
  gameId: number;
  phaseId: number;
  /** Absent while the board loads: the tabs show without counts. */
  board: BoardDoc | null;
  step: BoardStep;
  onStep: (step: string) => void;
}

/**
 * The board's steps, each with how far the phase has got there: "2/8 read",
 * "3 to resolve", the number of scenes, "1/8 ready". Read's and Write's
 * counts are over the same people as those steps' lists.
 */
export function BoardStepTabs({ gameId, phaseId, board, step, onStep }: BoardStepTabsProps) {
  const { cast, submitters } = useBoardPeople(gameId, phaseId);
  const results = useGameActionResults(gameId);
  const recipients = useMemo(
    () => writeList(cast.filter((c) => c.reads).map((c) => c.id), characterIdsWithResults(results.data ?? [], phaseId)),
    [cast, results.data, phaseId],
  );
  const progress = useMemo(() => (board ? stepProgress(board, { submitters, recipients }) : {}), [board, submitters, recipients]);

  return (
    <TabNavigation
      tabs={BOARD_STEPS.map((s) => ({ id: s.id, label: s.label, badge: progress[s.id] }))}
      activeTab={step}
      onTabChange={onStep}
      getTabHref={(id) => boardPath(gameId, phaseId, parseBoardStep(id))}
      embedded
    />
  );
}
