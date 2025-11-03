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

  async deleteCharacter(id: number) {
    return this.client.delete(`/api/v1/characters/${id}`);
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
    console.log('[Avatar Upload] Starting upload:', {
      characterId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    const formData = new FormData();
    formData.append('avatar', file);

    console.log('[Avatar Upload] FormData created, entries:', Array.from(formData.entries()).map(([key, value]) => ({
      key,
      value: value instanceof File ? { name: value.name, size: value.size, type: value.type } : value
    })));

    // CRITICAL: Must explicitly delete Content-Type header for multipart/form-data
    // The BaseApiClient sets a default 'Content-Type: application/json' header,
    // but for FormData uploads, axios needs to set the Content-Type itself with
    // the correct multipart boundary. We must delete the default header.
    try {
      const response = await this.client.post<{ avatar_url: string }>(
        `/api/v1/characters/${characterId}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': undefined, // Remove default Content-Type, let axios set it
          },
        }
      );
      console.log('[Avatar Upload] Success:', response);
      return response;
    } catch (error: any) {
      console.error('[Avatar Upload] Failed:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      throw error;
    }
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
