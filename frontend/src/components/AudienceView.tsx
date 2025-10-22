import { useState } from 'react';
import { AllPrivateMessagesView } from './AllPrivateMessagesView';
import { AllActionSubmissionsView } from './AllActionSubmissionsView';

interface AudienceViewProps {
  gameId: number;
}

type AudienceTab = 'messages' | 'actions';

/**
 * Main Audience View component with sub-tabs for different content types
 */
export function AudienceView({ gameId }: AudienceViewProps) {
  const [activeTab, setActiveTab] = useState<AudienceTab>('messages');

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="border-b border-border-primary">
        <nav className="-mb-px flex space-x-8" aria-label="Audience View Tabs">
          <button
            onClick={() => setActiveTab('messages')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'messages'
                  ? 'border-semantic-info text-semantic-info'
                  : 'border-transparent text-content-secondary hover:text-content-primary hover:border-border-primary'
              }
            `}
          >
            Private Messages
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'actions'
                  ? 'border-semantic-info text-semantic-info'
                  : 'border-transparent text-content-secondary hover:text-content-primary hover:border-border-primary'
              }
            `}
          >
            Action Submissions
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'messages' && <AllPrivateMessagesView gameId={gameId} />}
        {activeTab === 'actions' && <AllActionSubmissionsView gameId={gameId} />}
      </div>
    </div>
  );
}
