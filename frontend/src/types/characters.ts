// Character-related types for the frontend

export interface Character {
  id: number;
  game_id: number;
  user_id?: number;
  username?: string;
  name: string;
  character_type: 'player_character' | 'npc_gm' | 'npc_audience';
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'dead';
  created_at: string;
  updated_at: string;
}

export interface CharacterData {
  id: number;
  character_id: number;
  module_type: string;
  field_name: string;
  field_value?: string;
  field_type: 'text' | 'number' | 'boolean' | 'json';
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCharacterRequest {
  name: string;
  character_type: 'player_character' | 'npc_gm' | 'npc_audience';
}

export interface CharacterDataRequest {
  module_type: string;
  field_name: string;
  field_value: string;
  field_type: 'text' | 'number' | 'boolean' | 'json';
  is_public: boolean;
}

export interface ApproveCharacterRequest {
  status: 'approved' | 'rejected';
}

export interface AssignNPCRequest {
  assigned_user_id: number;
}

// Character module types for the modular character sheet system
export interface CharacterModule {
  type: string;
  name: string;
  description: string;
  fields: CharacterModuleField[];
}

export interface CharacterModuleField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'json';
  label: string;
  placeholder?: string;
  required?: boolean;
  isPublic?: boolean;
}

// Predefined character modules for MVP
export const CHARACTER_MODULES: CharacterModule[] = [
  {
    type: 'bio',
    name: 'Bio/Background',
    description: 'Character background and biography',
    fields: [
      {
        name: 'background',
        type: 'text',
        label: 'Background Story',
        placeholder: 'Tell your character\'s story...',
        isPublic: true
      },
      {
        name: 'appearance',
        type: 'text',
        label: 'Physical Appearance',
        placeholder: 'Describe how your character looks...',
        isPublic: true
      }
    ]
  },
  {
    type: 'notes',
    name: 'Private Notes',
    description: 'Private notes only visible to you and the GM',
    fields: [
      {
        name: 'private_notes',
        type: 'text',
        label: 'Private Notes',
        placeholder: 'Your private character notes...',
        isPublic: false
      },
      {
        name: 'secrets',
        type: 'text',
        label: 'Character Secrets',
        placeholder: 'Secrets about your character...',
        isPublic: false
      }
    ]
  },
  {
    type: 'abilities',
    name: 'Abilities & Skills',
    description: 'Character abilities, skills, and special powers',
    fields: [
      {
        name: 'abilities_list',
        type: 'text',
        label: 'Abilities',
        placeholder: 'List your character\'s abilities...',
        isPublic: true
      },
      {
        name: 'skills',
        type: 'text',
        label: 'Skills',
        placeholder: 'Character skills and proficiencies...',
        isPublic: true
      }
    ]
  },
  {
    type: 'inventory',
    name: 'Inventory',
    description: 'Character possessions and equipment',
    fields: [
      {
        name: 'equipment',
        type: 'text',
        label: 'Equipment',
        placeholder: 'List your character\'s equipment...',
        isPublic: true
      },
      {
        name: 'money',
        type: 'text',
        label: 'Currency/Resources',
        placeholder: 'Gold, credits, resources...',
        isPublic: false
      }
    ]
  }
];
