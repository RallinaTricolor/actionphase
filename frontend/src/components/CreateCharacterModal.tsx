import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreateCharacterRequest } from '../types/characters';
import { Modal } from './Modal';
import { Input, Button, Alert, Select } from './ui';

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
        { value: 'npc', label: 'NPC' }
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
        <Input
          label="Character Name"
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter character name..."
        />

        {/* Character Type */}
        <Select
          label="Character Type"
          id="character_type"
          value={formData.character_type}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            character_type: e.target.value as CreateCharacterRequest['character_type']
          }))}
          helperText={
            formData.character_type === 'player_character'
              ? "A character you'll control during the game"
              : "A non-player character (can be assigned to audience members)"
          }
        >
          {getAvailableCharacterTypes().map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createCharacterMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={createCharacterMutation.isPending}
            disabled={!formData.name.trim()}
          >
            Create Character
          </Button>
        </div>

        {/* Error Display */}
        {createCharacterMutation.error && (
          <Alert variant="danger" className="mt-3">
            Failed to create character: {
              createCharacterMutation.error instanceof Error
                ? createCharacterMutation.error.message
                : 'Unknown error'
            }
          </Alert>
        )}
      </form>
    </Modal>
  );
}
