import { useState } from 'react';
import { Alert, Badge, Button } from '@/components/ui';
import { CollapsibleMarkdown } from '@/components/common/markdown/CollapsibleMarkdown';
import { ConfirmModal } from '@/components/common/modals/ConfirmModal';
import { PublishResultConfirmationDialog } from '@/components/actions/PublishResultConfirmationDialog';
import { StagedPartStatus } from '@/components/actions/StagedPartStatus';
import { UpdateCharacterSheetModal } from '@/components/characters/UpdateCharacterSheetModal';
import { useToast } from '@/contexts/ToastContext';
import { useDraftUpdateCount } from '@/hooks';
import {
  useCancelPendingStagedPart,
  useDeleteActionResult,
  usePublishActionResult,
  useUpdateStagedPartDelay,
} from '@/hooks/useActionResults';
import { useConflictingSheetDrafts } from '@/hooks/useConflictingSheetDrafts';
import { truncate } from '@/lib/gmBoard/text';
import { canAppendPart, canCancelPart, hasChainControls, takesSheetUpdates } from '@/lib/resultParts';
import { MAX_CHAIN_PARTS } from '@/lib/stagedDelays';
import type { ResultChain } from '@/lib/gmBoard/results';
import type { ActionResult } from '@/types/phases';
import { logger } from '@/services/LoggingService';

interface ResultChainCardProps {
  gameId: number;
  chain: ResultChain;
  /** "Result 1", "Result 2": its place in the character's list. */
  label: string;
  characterId: number;
  characterName: string;
  /** Every result in the phase, for the sheet-update conflict check. */
  phaseResults: ActionResult[];
  /** The part in the editor below the list, marked here. */
  selectedId: number | null;
  onSelect: (partId: number) => void;
  /** A part not saved yet is being written for this chain: hide "+ Part". */
  addingPart: boolean;
  onAddPart: (tail: ActionResult) => void;
  /** Sends the editor's waiting text before publishing. */
  flush: () => Promise<void>;
  onDeleted: (chain: ResultChain) => void;
}

/**
 * One of a character's results: its parts in order, each with its schedule,
 * and the controls the results list gives the same result (lib/resultParts):
 * Publish and Delete on the head of a draft, sheet updates and "+ Part" on
 * the tail, Cancel and the delay on later parts not yet revealed.
 */
export function ResultChainCard({
  gameId,
  chain,
  label,
  characterId,
  characterName,
  phaseResults,
  selectedId,
  onSelect,
  addingPart,
  onAddPart,
  flush,
  onDeleted,
}: ResultChainCardProps) {
  const { head } = chain;
  const tail = chain.parts[chain.parts.length - 1];
  const { showError } = useToast();
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState<ActionResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const publish = usePublishActionResult(gameId);
  const remove = useDeleteActionResult(gameId);
  const cancelPart = useCancelPendingStagedPart(gameId);
  const retime = useUpdateStagedPartDelay(gameId);

  // Sheet drafts live on the tail, so the count and the conflict check do too.
  const { data: draftCount, isPending: countPending } = useDraftUpdateCount(gameId, tail.id);
  const { hasConflict } = useConflictingSheetDrafts(gameId, tail, phaseResults);
  // A count still loading counts as "maybe": the warning fails safe.
  const sheetConflict = !tail.is_published && hasConflict && (countPending || (draftCount ?? 0) > 0);

  const doPublish = async () => {
    try {
      await flush();
      await publish.mutateAsync(head.id);
      setPublishing(false);
    } catch (error) {
      logger.error('Failed to publish result from the board', { error, resultId: head.id, gameId });
      showError('Couldn’t publish this result. Try again.');
    }
  };
  const doDelete = async () => {
    try {
      await remove.mutateAsync(head.id);
      setDeleting(false);
      onDeleted(chain);
    } catch (error) {
      logger.error('Failed to delete result from the board', { error, resultId: head.id, gameId });
      showError('Couldn’t delete this result. Try again.');
    }
  };
  const doCancel = async () => {
    if (!cancelling) return;
    try {
      await cancelPart.mutateAsync(cancelling.id);
      setCancelling(null);
    } catch (error) {
      logger.error('Failed to cancel staged part from the board', { error, resultId: cancelling.id, gameId });
      showError('Couldn’t cancel this part. Try again.');
    }
  };
  const doRetime = async (part: ActionResult, delayMinutes: number) => {
    try {
      await retime.mutateAsync({ resultId: part.id, delayMinutes });
    } catch (error) {
      logger.error('Failed to change staged delay from the board', { error, resultId: part.id, gameId });
      showError('Couldn’t change this timer. Try again.');
    }
  };

  const staged = chain.parts.length > 1;

  return (
    <div
      className={`space-y-2 rounded-lg border p-3 ${head.is_published ? 'border-semantic-success' : 'border-theme-default'}`}
      data-testid={`result-chain-${head.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-content-primary">{label}</h4>
          {head.is_published ? (
            <Badge variant="success" size="sm">
              Published
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              Draft
            </Badge>
          )}
          {head.action_submission_id !== undefined && <span className="text-xs text-content-tertiary">answers their submission</span>}
          {head.is_published && head.sent_at && <span className="text-xs text-content-tertiary">Sent {new Date(head.sent_at).toLocaleString()}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {takesSheetUpdates(tail) && (
            <Button type="button" size="sm" variant="secondary" onClick={() => setSheetOpen(true)}>
              Update character sheet
              {(draftCount ?? 0) > 0 && (
                <Badge variant="warning" size="sm" className="ml-2" data-testid={`board-draft-update-count-${tail.id}`}>
                  {draftCount}
                </Badge>
              )}
            </Button>
          )}
          {hasChainControls(head) && (
            <>
              <Button type="button" size="sm" variant="danger" onClick={() => setDeleting(true)} disabled={remove.isPending}>
                Delete
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={() => setPublishing(true)} disabled={publish.isPending}>
                {staged ? `Publish (${chain.parts.length} parts)` : 'Publish'}
              </Button>
            </>
          )}
        </div>
      </div>

      {sheetConflict && (
        <Alert variant="danger" data-testid={`board-sheet-conflict-${tail.id}`}>
          Another draft result for {characterName} also has sheet updates. Publishing both will overwrite one with the other, so keep this phase’s sheet
          updates on one result.
        </Alert>
      )}

      <ol className="space-y-2">
        {chain.parts.map((part, i) => {
          const editing = part.id === selectedId && !part.is_published;
          return (
            <li key={part.id} className="space-y-1" data-testid={`result-part-${part.id}`}>
              {staged && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StagedPartStatus result={part} onDelayChange={(d) => void doRetime(part, d)} delayPending={retime.isPending} />
                  {canCancelPart(part) && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setCancelling(part)}>
                      Cancel part
                    </Button>
                  )}
                </div>
              )}
              {part.is_published ? (
                <div className="rounded border border-theme-default p-2">
                  <CollapsibleMarkdown content={part.content} mentionedCharacters={[]} fullWidth />
                </div>
              ) : editing ? (
                <p className="rounded border border-interactive-primary px-2 py-1.5 text-sm text-content-secondary" data-testid={`editing-part-${part.id}`}>
                  <Badge variant="primary" size="sm">
                    Editing below
                  </Badge>{' '}
                  {truncate(part.content, 120)}
                </p>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!block w-full !whitespace-normal rounded border border-dashed border-theme-default !px-2 !py-1.5 text-left !font-normal"
                  onClick={() => onSelect(part.id)}
                  aria-label={`Edit ${staged ? `part ${i + 1} of ${label}` : label}`}
                >
                  <span className="text-content-secondary">{part.content.trim() ? truncate(part.content, 200) : '(empty)'}</span>
                </Button>
              )}
            </li>
          );
        })}
      </ol>

      {canAppendPart(tail) && !addingPart && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={chain.parts.length >= MAX_CHAIN_PARTS}
          title={chain.parts.length >= MAX_CHAIN_PARTS ? `A result can have at most ${MAX_CHAIN_PARTS} parts` : 'Add a part revealed on a timer after the last one'}
          onClick={() => onAddPart(tail)}
          data-faro-user-action-name="add-staged-result-part"
        >
          + Part
        </Button>
      )}

      <UpdateCharacterSheetModal
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        gameId={gameId}
        actionResultId={tail.id}
        characterId={characterId}
        characterName={characterName}
      />
      <PublishResultConfirmationDialog
        isOpen={publishing}
        onConfirm={() => void doPublish()}
        onCancel={() => setPublishing(false)}
        gameId={gameId}
        actionResultId={tail.id}
        isPublishing={publish.isPending}
        hasConflictingSheetDrafts={sheetConflict}
      />
      <ConfirmModal
        isOpen={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => void doDelete()}
        title="Delete Draft Result"
        message={`This will permanently delete ${label.toLowerCase()} for ${characterName}${staged ? `, all ${chain.parts.length} parts` : ''}, including any pending character sheet updates.`}
        confirmText="Yes, Delete Draft"
        variant="danger"
        isLoading={remove.isPending}
      />
      <ConfirmModal
        isOpen={cancelling !== null}
        onClose={() => setCancelling(null)}
        onConfirm={() => void doCancel()}
        title="Cancel Part"
        message={
          cancelling
            ? `Part ${cancelling.part_number} hasn’t been revealed. Cancelling removes it${
                (cancelling.part_number ?? 0) < chain.parts.length ? ' and every part after it' : ''
              } permanently.`
            : ''
        }
        confirmText="Yes, Cancel This Part"
        variant="danger"
        isLoading={cancelPart.isPending}
      />
    </div>
  );
}
