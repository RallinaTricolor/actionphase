import type { GameApplication } from '../types/games';

interface GameApplicationStatusProps {
  application: GameApplication;
}

export function GameApplicationStatus({ application }: GameApplicationStatusProps) {
  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-blue-900">Your Application Status</h4>
          <p className="text-sm text-blue-700">
            Applied as {application.role} • Status: {application.status}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800`}>
          {application.status}
        </span>
      </div>
      {application.message && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-sm text-blue-700">
            <strong>Your message:</strong> "{application.message}"
          </p>
        </div>
      )}
    </div>
  );
}
