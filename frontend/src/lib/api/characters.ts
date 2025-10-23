import { BaseApiClient } from './client';
import type {
  Character,
  CharacterData,
  CreateCharacterRequest,
  CharacterDataRequest,
  ApproveCharacterRequest,
  AssignNPCRequest
} from '../../types/characters';

/**
 * Characters API client
 * Handles character creation, management, avatars, and data
 */
export class CharactersApi extends BaseApiClient {
  // Character CRUD endpoints
  async createCharacter(gameId: number, data: CreateCharacterRequest) {
    return this.client.post<Character>(`/api/v1/games/${gameId}/characters`, data);
  }

  async getGameCharacters(gameId: number) {
    return this.client.get<Character[]>(`/api/v1/games/${gameId}/characters`);
  }

  async getUserControllableCharacters(gameId: number) {
    return this.client.get<Character[]>(`/api/v1/games/${gameId}/characters/controllable`);
  }

  async getCharacter(id: number) {
    return this.client.get<Character>(`/api/v1/characters/${id}`);
  }

  async approveCharacter(id: number, data: ApproveCharacterRequest) {
    return this.client.post<Character>(`/api/v1/characters/${id}/approve`, data);
  }

  async assignNPC(id: number, data: AssignNPCRequest) {
    return this.client.post(`/api/v1/characters/${id}/assign`, data);
  }

  // Character Data endpoints
  async setCharacterData(id: number, data: CharacterDataRequest) {
    return this.client.post(`/api/v1/characters/${id}/data`, data);
  }

  async getCharacterData(id: number) {
    return this.client.get<CharacterData[]>(`/api/v1/characters/${id}/data`);
  }

  // Avatar endpoints
  async uploadCharacterAvatar(characterId: number, file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.client.post<{ avatar_url: string }>(
      `/api/v1/characters/${characterId}/avatar`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  }

  async deleteCharacterAvatar(characterId: number) {
    return this.client.delete(`/api/v1/characters/${characterId}/avatar`);
  }

  // Player Management endpoints (GM only)
  async reassignCharacter(characterId: number, data: { new_owner_user_id: number }) {
    return this.client.put<Character>(`/api/v1/characters/${characterId}/reassign`, data);
  }

  async getInactiveCharacters(gameId: number) {
    return this.client.get<Character[]>(`/api/v1/games/${gameId}/characters/inactive`);
  }

  // Audience Participation endpoints
  async listAudienceNPCs(gameId: number) {
    return this.client.get<{ npcs: Character[] }>(`/api/v1/games/${gameId}/characters/audience-npcs`);
  }
}
