import { Link, useSearchParams } from 'react-router-dom';
import { Card, Badge, Button } from './ui';
import type { Handout } from '../types/handouts';

interface HandoutCardProps {
  handout: Handout;
  isGM: boolean;
  onEdit?: (handout: Handout) => void;
  onDelete?: (handout: Handout) => void;
  onPublish?: (handout: Handout) => void;
  onUnpublish?: (handout: Handout) => void;
}

export function HandoutCard({
  handout,
  isGM,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish
}: HandoutCardProps) {
  const [searchParams] = useSearchParams();
  const viewHref = (() => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'handouts');
    params.set('handout', String(handout.id));
    return `?${params.toString()}`;
  })();

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

        {handout.updated_at && handout.created_at && handout.updated_at !== handout.created_at && (
          <p className="text-sm text-content-tertiary">
            Edited {new Date(handout.updated_at).toLocaleString()}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          <Link
            to={viewHref}
            className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-interactive-primary focus:ring-offset-2 bg-interactive-primary hover:bg-interactive-primary-hover text-content-inverse px-3 py-1.5 text-sm"
          >
            View
          </Link>

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
                    // eslint-disable-next-line no-alert
                    if (window.confirm(`Are you sure you want to delete "${handout.title}"?`)) {
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
