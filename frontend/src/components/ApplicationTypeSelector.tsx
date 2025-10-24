import { Radio } from './ui/Radio';

interface ApplicationTypeSelectorProps {
  gameState: string;
  selectedType: 'player' | 'audience';
  onTypeChange: (type: 'player' | 'audience') => void;
}

/**
 * Component to select between player and audience application types
 * Shows both options during recruitment, only audience after recruitment ends
 */
export function ApplicationTypeSelector({
  gameState,
  selectedType,
  onTypeChange,
}: ApplicationTypeSelectorProps) {
  const isRecruitment = gameState === 'recruitment';

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-content-primary">
        Application Type
      </div>

      <div className="space-y-2">
        {isRecruitment && (
          <Radio
            name="applicationType"
            value="player"
            checked={selectedType === 'player'}
            onChange={() => onTypeChange('player')}
            label="Player"
            helperText="Join as an active player with your own character"
          />
        )}

        <Radio
          name="applicationType"
          value="audience"
          checked={selectedType === 'audience'}
          onChange={() => onTypeChange('audience')}
          label="Audience"
          helperText="Follow the game and view all private messages and action submissions"
        />
      </div>

      {!isRecruitment && (
        <p className="text-xs text-content-secondary mt-2">
          Player recruitment has ended. You can still join as an audience member to follow the game.
        </p>
      )}
    </div>
  );
}
