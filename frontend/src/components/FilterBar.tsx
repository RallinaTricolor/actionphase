import { useState } from 'react';
import {
  GAME_STATE_LABELS,
  SORT_BY_LABELS,
  type GameState,
  type ParticipationFilter,
  type SortBy,
} from '../types/games';

interface FilterBarProps {
  // Current filter values
  selectedStates: GameState[];
  participation?: ParticipationFilter;
  hasOpenSpots?: boolean;
  sortBy: SortBy;

  // Available options
  availableStates: GameState[];

  // Callbacks
  onStatesChange: (states: GameState[]) => void;
  onParticipationChange: (participation?: ParticipationFilter) => void;
  onHasOpenSpotsChange: (hasOpenSpots?: boolean) => void;
  onSortByChange: (sortBy: SortBy) => void;
  onClearFilters: () => void;

  // Metadata
  filteredCount: number;
  totalCount: number;
}

export function FilterBar({
  selectedStates,
  participation,
  hasOpenSpots,
  sortBy,
  availableStates,
  onStatesChange,
  onParticipationChange,
  onHasOpenSpotsChange,
  onSortByChange,
  onClearFilters,
  filteredCount,
  totalCount,
}: FilterBarProps) {
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  const hasActiveFilters =
    selectedStates.length > 0 ||
    participation !== undefined ||
    hasOpenSpots !== undefined;

  const handleStateToggle = (state: GameState) => {
    if (selectedStates.includes(state)) {
      onStatesChange(selectedStates.filter((s) => s !== state));
    } else {
      onStatesChange([...selectedStates, state]);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Top row: Quick filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Participation quick filters */}
          <div className="flex gap-2">
            <button
              onClick={() => onParticipationChange(undefined)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                !participation || participation === null
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Games
            </button>
            <button
              onClick={() => onParticipationChange('my_games')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                participation === 'my_games'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              My Games
            </button>
            <button
              onClick={() => onParticipationChange('applied')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                participation === 'applied'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Applied
            </button>
            <button
              onClick={() => onParticipationChange('not_joined')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                participation === 'not_joined'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Not Joined
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Results count */}
          <div className="text-sm text-gray-600">
            Showing <span className="font-medium text-gray-900">{filteredCount}</span> of{' '}
            <span className="font-medium text-gray-900">{totalCount}</span> games
          </div>
        </div>

        {/* Bottom row: Advanced filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* State filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStateDropdown(!showStateDropdown)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-2"
            >
              <span>State</span>
              {selectedStates.length > 0 && (
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs">
                  {selectedStates.length}
                </span>
              )}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showStateDropdown && (
              <div className="absolute z-10 mt-2 w-56 bg-white border border-gray-300 rounded-md shadow-lg">
                <div className="py-1 max-h-60 overflow-auto">
                  {availableStates.map((state) => (
                    <label
                      key={state}
                      className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStates.includes(state)}
                        onChange={() => handleStateToggle(state)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">{GAME_STATE_LABELS[state]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Has open spots toggle */}
          <button
            onClick={() => onHasOpenSpotsChange(hasOpenSpots ? undefined : true)}
            className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
              hasOpenSpots
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            {hasOpenSpots && (
              <svg
                className="inline h-4 w-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            Has Open Spots
          </button>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortBy)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {(Object.keys(SORT_BY_LABELS) as SortBy[]).map((key) => (
              <option key={key} value={key}>
                Sort: {SORT_BY_LABELS[key]}
              </option>
            ))}
          </select>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
