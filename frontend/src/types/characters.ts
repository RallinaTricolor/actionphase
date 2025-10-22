// Character-related types for the frontend

export interface Character {
  id: number;
  game_id: number;
  user_id?: number;
  username?: string;
  name: string;
  character_type: 'player_character' | 'npc';
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'dead';
  avatar_url?: string | null;
  is_active: boolean;
  original_owner_user_id?: number;
  original_owner_username?: string;
  current_owner_username?: string;
  // NPC assignment fields (only present for NPCs)
  assigned_user_id?: number;
  assigned_username?: string;
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
  character_type: 'player_character' | 'npc';
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

export interface ReassignCharacterRequest {
  new_owner_user_id: number;
}

// Individual ability/skill item structures for JSON fields
export interface CharacterAbility {
  id: string; // UUID or unique identifier
  name: string;
  description?: string;
  type: 'innate' | 'learned' | 'gm_assigned';
  source?: string; // Who assigned it (GM name, class, etc.)
  active: boolean;
  metadata?: Record<string, any>; // For game-specific stats
}

export interface CharacterSkill {
  id: string;
  name: string;
  level?: number | string; // Could be numeric or descriptive like "Expert"
  description?: string;
  category?: string; // e.g., "Combat", "Social", "Academic"
  metadata?: Record<string, any>;
}

// Individual inventory item structures for JSON fields
export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  category?: string; // e.g., "Weapon", "Armor", "Consumable", "Tool"
  condition?: string; // e.g., "Excellent", "Good", "Damaged"
  value?: number;
  weight?: number;
  equipped?: boolean; // For equipment/weapons
  metadata?: Record<string, any>; // Game-specific properties
}

export interface CurrencyEntry {
  id: string;
  type: string; // e.g., "Gold", "Credits", "XP", "Reputation"
  amount: number;
  description?: string;
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
        label: 'Public Profile',
        placeholder: 'What\'s visible at a glance...',
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
        name: 'abilities',
        type: 'json',
        label: 'Abilities',
        placeholder: 'Manage your character abilities...',
        isPublic: true
      },
      {
        name: 'skills',
        type: 'json',
        label: 'Skills',
        placeholder: 'Manage your character skills...',
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
        name: 'items',
        type: 'json',
        label: 'Items',
        placeholder: 'Manage your character items...',
        isPublic: true
      },
      {
        name: 'currency',
        type: 'json',
        label: 'Currency/Resources',
        placeholder: 'Track your character\'s resources...',
        isPublic: false
      }
    ]
  }
];
