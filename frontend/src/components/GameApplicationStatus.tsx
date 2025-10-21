import type { GameApplication } from '../types/games';
import { Badge } from './ui';

interface GameApplicationStatusProps {
  application: GameApplication;
}

export function GameApplicationStatus({ application }: GameApplicationStatusProps) {
  return (
    <div className="mb-6 p-4 bg-interactive-primary-subtle border border-interactive-primary rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-content-primary">Your Application Status</h4>
          <p className="text-sm text-content-secondary">
            Applied as {application.role} • Status: {application.status}
          </p>
        </div>
        <Badge variant="primary">
          {application.status}
        </Badge>
      </div>
      {application.message && (
        <div className="mt-3 pt-3 border-t border-interactive-primary">
          <p className="text-sm text-content-secondary">
            <strong>Your message:</strong> "{application.message}"
          </p>
        </div>
      )}
    </div>
  );
}
