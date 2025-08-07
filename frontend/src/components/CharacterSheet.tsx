import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CharacterData, CharacterDataRequest } from '../types/characters';
import { CHARACTER_MODULES } from '../types/characters';

interface CharacterSheetProps {
  characterId: number;
  canEdit?: boolean;
  onClose?: () => void;
}

export function CharacterSheet({ characterId, canEdit = false, onClose }: CharacterSheetProps) {
  const [activeModule, setActiveModule] = useState('bio');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  const { data: character } = useQuery({
    queryKey: ['character', characterId],
    queryFn: () => apiClient.getCharacter(characterId).then(res => res.data),
    enabled: !!characterId
  });

  const { data: characterData = [], isLoading } = useQuery({
    queryKey: ['characterData', characterId],
    queryFn: () => apiClient.getCharacterData(characterId).then(res => res.data),
    enabled: !!characterId
  });

  const saveCharacterDataMutation = useMutation({
    mutationFn: (data: CharacterDataRequest) =>
      apiClient.setCharacterData(characterId, data),
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
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b border-gray-200">
        <div className="flex justify-between items-center p-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {character?.name || 'Character Sheet'}
            </h2>
            {character && (
              <p className="text-sm text-gray-600 mt-1">
                {character.character_type.replace('_', ' ')} • Status: {character.status}
              </p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Module Tabs */}
        <div className="flex space-x-8 px-6">
          {CHARACTER_MODULES.map((module) => (
            <button
              key={module.type}
              onClick={() => setActiveModule(module.type)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeModule === module.type
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {module.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {CHARACTER_MODULES.filter(module => module.type === activeModule).map((module) => (
          <div key={module.type}>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">{module.name}</h3>
              <p className="text-sm text-gray-600">{module.description}</p>
            </div>

            <div className="space-y-6">
              {module.fields.map((field) => {
                const key = `${module.type}_${field.name}`;
                const fieldData = getFieldData(module.type, field.name);
                const value = getFieldValue(module.type, field.name);
                const isEditing = editingField === key;

                return (
                  <div key={field.name} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {fieldData && (
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              field.isPublic
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {field.isPublic ? 'Public' : 'Private'}
                            </span>
                            <span className="text-xs text-gray-500">
                              Last updated: {new Date(fieldData.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {canEdit && !isEditing && (
                        <button
                          onClick={() => handleFieldEdit(module.type, field.name)}
                          className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 focus:outline-none"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={value}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                          rows={field.type === 'text' ? 4 : 1}
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setEditingField(null)}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                            disabled={saveCharacterDataMutation.isPending}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleFieldSave(
                              module.type,
                              field.name,
                              field.type,
                              field.isPublic ?? true
                            )}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            disabled={saveCharacterDataMutation.isPending}
                          >
                            {saveCharacterDataMutation.isPending ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {value ? (
                          <div className="text-sm text-gray-900 whitespace-pre-wrap">
                            {value}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500 italic">
                            {field.placeholder || 'No content yet...'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Error Display */}
        {saveCharacterDataMutation.error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">
              Failed to save: {
                saveCharacterDataMutation.error instanceof Error
                  ? saveCharacterDataMutation.error.message
                  : 'Unknown error'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
