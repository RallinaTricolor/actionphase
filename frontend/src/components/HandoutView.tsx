import { useState } from 'react';
import { Card, Button, Badge, Alert, Spinner } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { CommentEditor } from './CommentEditor';
import { useHandoutComments } from '../hooks/useHandoutComments';
import type { Handout } from '../types/handouts';
import { logger } from '@/services/LoggingService';

interface HandoutViewProps {
  gameId: number;
  handout: Handout;
  isGM: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function HandoutView({ gameId, handout, isGM, onClose, onEdit }: HandoutViewProps) {
  const {
    comments,
    isLoading: commentsLoading,
    createCommentMutation,
  } = useHandoutComments(gameId, handout.id);

  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusBadgeVariant = handout.status === 'published' ? 'success' : 'warning';

  const handleSubmitNote = async () => {
    if (!newNoteContent.trim()) return;

    setIsSubmitting(true);
    try {
      await createCommentMutation.mutateAsync({ content: newNoteContent });
      setNewNoteContent(''); // Clear the form on success
    } catch (error) {
      logger.error('Failed to create GM note', { error, gameId, handoutId: handout.id, handoutTitle: handout.title });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card variant="elevated" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Handouts
          </Button>

          {isGM && onEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-content-primary">{handout.title}</h1>
              <Badge variant={statusBadgeVariant}>
                {handout.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </div>

            {handout.updated_at && (
              <p className="text-sm text-content-tertiary">
                Last updated {new Date(handout.updated_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="border-t border-border-primary pt-4">
            <MarkdownPreview content={handout.content} />
          </div>
        </div>
      </Card>

      {/* Comments/Updates section - Public to all players */}
      <Card variant="elevated" padding="lg">
        <h2 className="text-xl font-bold text-content-primary mb-4">Updates & Comments</h2>
        <p className="text-sm text-content-secondary mb-4">
          {isGM
            ? "Add updates, clarifications, or additional information about this handout. All players can see these comments."
            : "GM updates and additional information about this handout."}
        </p>

        {/* New Comment Form - GM Only */}
        {isGM && (
          <div className="mb-6 space-y-3">
            <CommentEditor
              value={newNoteContent}
              onChange={setNewNoteContent}
              placeholder="Add an update or clarification about this handout..."
              disabled={isSubmitting}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNewNoteContent('')}
                disabled={!newNoteContent.trim() || isSubmitting}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitNote}
                disabled={!newNoteContent.trim() || isSubmitting}
                loading={isSubmitting}
              >
                Post Update
              </Button>
            </div>
          </div>
        )}

        {/* Existing Comments */}
        <div className={isGM ? "border-t border-border-primary pt-4" : ""}>
          {isGM && <h3 className="text-sm font-semibold text-content-secondary mb-3">Previous Updates</h3>}
          {commentsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" label="Loading updates..." />
            </div>
          ) : comments.length === 0 ? (
            <Alert variant="info">
              {isGM ? "No updates posted yet." : "No additional information available for this handout."}
            </Alert>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="border border-border-primary rounded-lg p-4 bg-bg-secondary">
                  <MarkdownPreview content={comment.content} />
                  <p className="text-sm text-content-tertiary mt-2">
                    {new Date(comment.created_at || '').toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
