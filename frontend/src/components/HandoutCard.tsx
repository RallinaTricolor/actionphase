import { Card, Badge, Button } from './ui';
import type { Handout } from '../types/handouts';

interface HandoutCardProps {
  handout: Handout;
  isGM: boolean;
  onView: (handout: Handout) => void;
  onEdit?: (handout: Handout) => void;
  onDelete?: (handout: Handout) => void;
  onPublish?: (handout: Handout) => void;
  onUnpublish?: (handout: Handout) => void;
}

export function HandoutCard({
  handout,
  isGM,
  onView,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish
}: HandoutCardProps) {
  const statusBadgeVariant = handout.status === 'published' ? 'success' : 'warning';

  return (
    <Card variant="default" padding="md" className="hover:shadow-lg transition-shadow" data-testid="handout-card">
      <div className="flex flex-col space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-content-primary" data-testid="handout-title">{handout.title}</h3>
            <div className="mt-1">
              <Badge variant={statusBadgeVariant}>
                {handout.status === 'published' ? 'Published' : 'Draft'}
              </Badge>
            </div>
          </div>
        </div>

        {handout.updated_at && (
          <p className="text-sm text-content-tertiary">
            Updated {new Date(handout.updated_at).toLocaleString()}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onView(handout)}
          >
            View
          </Button>

          {isGM && (
            <>
              {onEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(handout)}
                >
                  Edit
                </Button>
              )}

              {handout.status === 'draft' && onPublish && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onPublish(handout)}
                >
                  Publish
                </Button>
              )}

              {handout.status === 'published' && onUnpublish && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onUnpublish(handout)}
                >
                  Unpublish
                </Button>
              )}

              {onDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${handout.title}"?`)) {
                      onDelete(handout);
                    }
                  }}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
