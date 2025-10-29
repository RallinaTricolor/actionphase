import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CharacterData, CharacterDataRequest, CharacterAbility, CharacterSkill, InventoryItem, CurrencyEntry } from '../types/characters';
import { CHARACTER_MODULES } from '../types/characters';
import { AbilitiesManager } from './AbilitiesManager';
import { InventoryManager } from './InventoryManager';
import CharacterAvatar from './CharacterAvatar';
import AvatarUploadModal from './AvatarUploadModal';
import { Button, Textarea, Badge } from './ui';

interface CharacterSheetProps {
  characterId: number;
  canEdit?: boolean;
  canEditStats?: boolean; // Separate permission for abilities, skills, items, currency (GM only)
  onClose?: () => void;
}

export function CharacterSheet({ characterId, canEdit = false, canEditStats = false, onClose }: CharacterSheetProps) {
  const [activeModule, setActiveModule] = useState('bio');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const queryClient = useQueryClient();

  // If user cannot edit and is viewing a restricted module, switch to bio
  useEffect(() => {
    if (!canEdit && activeModule !== 'bio') {
      setActiveModule('bio');
    }
  }, [canEdit, activeModule]);

  const { data: character } = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => apiClient.characters.getCharacter(characterId).then(res => res.data),
    enabled: !!characterId
  });

  const { data: characterData = [], isLoading } = useQuery({
    queryKey: ['characterData', characterId],
    queryFn: () => apiClient.characters.getCharacterData(characterId).then(res => res.data),
    enabled: !!characterId
  });

  const saveCharacterDataMutation = useMutation({
    mutationFn: (data: CharacterDataRequest) =>
      apiClient.characters.setCharacterData(characterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characterData', characterId] });
      setEditingField(null);
    }
  });

  // Initialize field values from character data
  useEffect(() => {
    const values: Record<string, string> = {};
    characterData.forEach(data => {
      const key = `${data.module_type}_${data.field_name}`;
      values[key] = data.field_value || '';
    });
    setFieldValues(values);
  }, [characterData]);

  // Get field value for display
  const getFieldValue = (moduleType: string, fieldName: string): string => {
    const key = `${moduleType}_${fieldName}`;
    return fieldValues[key] || '';
  };

  // Parse JSON field values for abilities and inventory
  const parseJsonField = (moduleType: string, fieldName: string): any => {
    const value = getFieldValue(moduleType, fieldName);
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  };

  // Save JSON field values
  const saveJsonField = (moduleType: string, fieldName: string, data: any) => {
    const value = JSON.stringify(data);
    saveCharacterDataMutation.mutate({
      module_type: moduleType,
      field_name: fieldName,
      field_value: value,
      field_type: 'json',
      is_public: fieldName !== 'currency' // currency is private, others are public
    });
  };

  // Get field data object
  const getFieldData = (moduleType: string, fieldName: string): CharacterData | undefined => {
    return characterData.find(data =>
      data.module_type === moduleType && data.field_name === fieldName
    );
  };

  // Handle field edit
  const handleFieldEdit = (moduleType: string, fieldName: string) => {
    if (!canEdit) return;
    setEditingField(`${moduleType}_${fieldName}`);
  };

  // Handle field save
  const handleFieldSave = (moduleType: string, fieldName: string, fieldType: string, isPublic: boolean) => {
    const key = `${moduleType}_${fieldName}`;
    const value = fieldValues[key] || '';

    saveCharacterDataMutation.mutate({
      module_type: moduleType,
      field_name: fieldName,
      field_value: value,
      field_type: fieldType as 'text' | 'number' | 'boolean' | 'json',
      is_public: isPublic
    });
  };

  // Handle field value change
  const handleFieldChange = (key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="surface-base rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 surface-sunken rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 surface-sunken rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-base rounded-lg shadow-lg min-h-[600px] flex flex-col">
      <div className="border-b border-theme-default">
        <div className="flex justify-between items-center p-8">
          <div className="flex items-center gap-6">
            {/* Character Avatar */}
            {character && (
              <div className="relative">
                <CharacterAvatar
                  avatarUrl={character.avatar_url}
                  characterName={character.name}
                  size="xl"
                />
                {canEdit && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="absolute -bottom-1 -right-1 rounded-full p-1.5 shadow-lg"
                    title="Upload Avatar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Button>
                )}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-content-primary mb-1">
                {character?.name || 'Character Sheet'}
              </h2>
              {character && (
                <div className="flex items-center gap-3">
                  <Badge variant="primary" size="md">
                    {character.character_type.replace('_', ' ')}
                  </Badge>
                  <Badge variant={character.status === 'approved' ? 'success' : 'warning'} size="md">
                    {character.status}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-content-tertiary hover:text-content-secondary h-auto p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
        </div>

        {/* Module Tabs - Filter out modules user cannot view */}
        <div className="flex space-x-1 px-8">
          {CHARACTER_MODULES.filter((module) => {
            // Bio is always visible (public information)
            if (module.type === 'bio') return true;
            // Private modules only visible to editors (GM, owner, audience)
            return canEdit;
          }).map((module) => (
            <Button
              key={module.type}
              variant="ghost"
              onClick={() => setActiveModule(module.type)}
              className={`py-3 px-6 border-b-2 font-medium transition-colors rounded-none ${
                activeModule === module.type
                  ? 'border-interactive-primary text-interactive-primary'
                  : 'border-transparent text-content-secondary hover:text-content-primary hover:border-border-primary'
              }`}
            >
              {module.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {CHARACTER_MODULES.filter(module => {
          // Only render modules the user has permission to view
          if (module.type === 'bio') return true;
          return canEdit;
        }).filter(module => module.type === activeModule).map((module) => (
          <div key={module.type} className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-content-primary mb-2">{module.name}</h3>
              <p className="text-content-secondary">{module.description}</p>
            </div>

            {/* Render specialized components for abilities and inventory modules */}
            {module.type === 'abilities' ? (
              <AbilitiesManager
                abilities={parseJsonField('abilities', 'abilities') as CharacterAbility[]}
                skills={parseJsonField('abilities', 'skills') as CharacterSkill[]}
                canEdit={canEditStats}
                onAbilitiesChange={(abilities) => saveJsonField('abilities', 'abilities', abilities)}
                onSkillsChange={(skills) => saveJsonField('abilities', 'skills', skills)}
              />
            ) : module.type === 'inventory' ? (
              <InventoryManager
                items={parseJsonField('inventory', 'items') as InventoryItem[]}
                currency={parseJsonField('inventory', 'currency') as CurrencyEntry[]}
                canEdit={canEditStats}
                onItemsChange={(items) => saveJsonField('inventory', 'items', items)}
                onCurrencyChange={(currency) => saveJsonField('inventory', 'currency', currency)}
              />
            ) : (
              /* Regular text-based fields for bio and notes modules */
              <div className="space-y-6">
                {module.fields.map((field) => {
                  const key = `${module.type}_${field.name}`;
                  const fieldData = getFieldData(module.type, field.name);
                  const value = getFieldValue(module.type, field.name);
                  const isEditing = editingField === key;

                  // Hide private fields if user cannot edit
                  // If fieldData exists, use its is_public value; otherwise fall back to field.isPublic
                  const isFieldPublic = fieldData ? fieldData.is_public : (field.isPublic ?? true);
                  if (!canEdit && !isFieldPublic) {
                    return null; // Don't render private fields for viewers
                  }

                  return (
                    <div key={field.name} className="border border-theme-default rounded-lg p-6 bg-surface-raised shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <label className="block text-base font-semibold text-content-primary mb-1">
                            {field.label}
                            {field.required && <span className="text-semantic-danger ml-1">*</span>}
                          </label>
                          {fieldData && (
                            <div className="flex items-center space-x-3 mt-2">
                              <Badge variant={isFieldPublic ? 'success' : 'warning'} size="sm">
                                {isFieldPublic ? 'Public' : 'Private'}
                              </Badge>
                              <span className="text-xs text-content-tertiary">
                                Updated {new Date(fieldData.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>

                        {canEdit && !isEditing && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleFieldEdit(module.type, field.name)}
                            className="flex-shrink-0"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </Button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-4">
                          <Textarea
                            value={value}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={8}
                            className="min-h-[200px] text-base"
                          />
                          <div className="flex justify-end space-x-3">
                            <Button
                              variant="ghost"
                              size="md"
                              onClick={() => setEditingField(null)}
                              disabled={saveCharacterDataMutation.isPending}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="md"
                              onClick={() => handleFieldSave(
                                module.type,
                                field.name,
                                field.type,
                                field.isPublic ?? true
                              )}
                              disabled={saveCharacterDataMutation.isPending}
                              loading={saveCharacterDataMutation.isPending}
                            >
                              {saveCharacterDataMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          {value ? (
                            <div className="text-base text-content-primary whitespace-pre-wrap leading-relaxed">
                              {value}
                            </div>
                          ) : (
                            <div className="text-base text-content-tertiary italic py-8 text-center">
                              {canEdit ? field.placeholder || 'Click "Edit" to add content...' : 'No content yet...'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Error Display */}
        {saveCharacterDataMutation.error && (
          <div className="mt-4 p-3 bg-semantic-danger-subtle border border-semantic-danger rounded-lg">
            <p className="text-sm text-semantic-danger">
              Failed to save: {
                saveCharacterDataMutation.error instanceof Error
                  ? saveCharacterDataMutation.error.message
                  : 'Unknown error'
              }
            </p>
          </div>
        )}
      </div>

      {/* Avatar Upload Modal */}
      {character && (
        <AvatarUploadModal
          isOpen={isAvatarModalOpen}
          onClose={() => setIsAvatarModalOpen(false)}
          characterId={character.id}
          characterName={character.name}
          currentAvatarUrl={character.avatar_url}
          onUploadSuccess={() => {
            // Refetch character data to immediately show new avatar
            queryClient.refetchQueries({ queryKey: ['character', characterId] });
          }}
        />
      )}
    </div>
  );
}
