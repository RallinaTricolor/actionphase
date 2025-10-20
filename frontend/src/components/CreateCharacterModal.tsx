import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreateCharacterRequest } from '../types/characters';
import { Modal } from './Modal';

interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: number;
  userRole?: string; // 'gm', 'player', 'audience'
}

export function CreateCharacterModal({
  isOpen,
  onClose,
  gameId,
  userRole = 'player'
}: CreateCharacterModalProps) {
  const [formData, setFormData] = useState<CreateCharacterRequest>({
    name: '',
    character_type: 'player_character'
  });

  const queryClient = useQueryClient();

  const createCharacterMutation = useMutation({
    mutationFn: (data: CreateCharacterRequest) =>
      apiClient.characters.createCharacter(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', gameId] });
      onClose();
      setFormData({ name: '', character_type: 'player_character' });
    },
    onError: (error) => {
      console.error('Failed to create character:', error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createCharacterMutation.mutate(formData);
  };

  const handleClose = () => {
    onClose();
    setFormData({ name: '', character_type: 'player_character' });
  };

  // Determine available character types based on user role
  const getAvailableCharacterTypes = () => {
    if (userRole === 'gm') {
      return [
        { value: 'player_character', label: 'Player Character' },
        { value: 'npc_gm', label: 'GM-Controlled NPC' },
        { value: 'npc_audience', label: 'Audience NPC' }
      ];
    } else {
      return [
        { value: 'player_character', label: 'Player Character' }
      ];
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Character">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Character Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Character Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter character name..."
            required
          />
        </div>

        {/* Character Type */}
        <div>
          <label htmlFor="character_type" className="block text-sm font-medium text-gray-700 mb-1">
            Character Type
          </label>
          <select
            id="character_type"
            value={formData.character_type}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              character_type: e.target.value as CreateCharacterRequest['character_type']
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {getAvailableCharacterTypes().map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Help text */}
          <div className="mt-1 text-xs text-gray-500">
            {formData.character_type === 'player_character' &&
              "A character you'll control during the game"}
            {formData.character_type === 'npc_gm' &&
              "An NPC controlled by the GM"}
            {formData.character_type === 'npc_audience' &&
              "An NPC that can be assigned to audience members"}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={createCharacterMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={createCharacterMutation.isPending || !formData.name.trim()}
          >
            {createCharacterMutation.isPending ? 'Creating...' : 'Create Character'}
          </button>
        </div>

        {/* Error Display */}
        {createCharacterMutation.error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              Failed to create character: {
                createCharacterMutation.error instanceof Error
                  ? createCharacterMutation.error.message
                  : 'Unknown error'
              }
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
