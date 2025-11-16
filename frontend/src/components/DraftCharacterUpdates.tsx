import { useState } from 'react';
import {
  useDraftCharacterUpdates,
  useCreateDraftCharacterUpdate,
  useUpdateDraftCharacterUpdate,
  useDeleteDraftCharacterUpdate,
} from '../hooks';
import { Card, CardHeader, CardBody, Button, Input, Select, Badge, Alert, Spinner } from './ui';
import type { CreateDraftCharacterUpdateRequest, DraftCharacterUpdate } from '../types/phases';
import { logger } from '@/services/LoggingService';

interface DraftCharacterUpdatesProps {
  gameId: number;
  resultId: number;
  characterId: number;
  onClose?: () => void;
}

const MODULE_TYPES = [
  { value: 'abilities', label: 'Abilities' },
  { value: 'skills', label: 'Skills' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'currency', label: 'Currency' },
] as const;

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' },
] as const;

const OPERATIONS = [
  { value: 'upsert', label: 'Upsert (Create/Update)' },
  { value: 'delete', label: 'Delete' },
] as const;

export function DraftCharacterUpdates({ gameId, resultId, characterId, onClose }: DraftCharacterUpdatesProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Query hooks
  const { data: drafts, isLoading, error } = useDraftCharacterUpdates(gameId, resultId);

  // Mutation hooks
  const createDraft = useCreateDraftCharacterUpdate(gameId, resultId);
  const updateDraft = useUpdateDraftCharacterUpdate(gameId, resultId);
  const deleteDraft = useDeleteDraftCharacterUpdate(gameId, resultId);

  // Form state for new draft
  const [newDraft, setNewDraft] = useState<CreateDraftCharacterUpdateRequest>({
    character_id: characterId,
    module_type: 'abilities',
    field_name: '',
    field_value: '',
    field_type: 'text',
    operation: 'upsert',
  });

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDraft.mutateAsync(newDraft);
      // Reset form
      setNewDraft({
        character_id: characterId,
        module_type: 'abilities',
        field_name: '',
        field_value: '',
        field_type: 'text',
        operation: 'upsert',
      });
      setIsAddingNew(false);
    } catch (_err) {
      logger.error('Failed to create draft character update', { error: err, gameId, resultId, characterId });
    }
  };

  const handleStartEdit = (draft: DraftCharacterUpdate) => {
    setEditingDraftId(draft.id);
    setEditValue(draft.field_value);
  };

  const handleSaveEdit = async (draftId: number) => {
    try {
      await updateDraft.mutateAsync({ draftId, fieldValue: editValue });
      setEditingDraftId(null);
      setEditValue('');
    } catch (_err) {
      logger.error('Failed to update draft character update', { error: err, gameId, resultId, draftId });
    }
  };

  const handleCancelEdit = () => {
    setEditingDraftId(null);
    setEditValue('');
  };

  const handleDelete = async (draftId: number) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Are you sure you want to delete this draft update?')) {
      return;
    }
    try {
      await deleteDraft.mutateAsync(draftId);
    } catch (err) {
      logger.error('Failed to delete draft character update', { error: err, gameId, resultId, draftId });
    }
  };

  if (isLoading) {
    return (
      <Card variant="default">
        <CardBody>
          <div className="flex justify-center py-8">
            <Spinner size="lg" />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" title="Error">
        Failed to load draft character updates.
      </Alert>
    );
  }

  return (
    <Card variant="default">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Draft Character Updates</h3>
          <div className="flex gap-2">
            {!isAddingNew && (
              <Button variant="primary" size="sm" onClick={() => setIsAddingNew(true)}>
                Add Update
              </Button>
            )}
            {onClose && (
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardBody>
        {/* Add New Draft Form */}
        {isAddingNew && (
          <form onSubmit={handleCreateDraft} className="mb-6 p-4 bg-bg-secondary rounded-lg space-y-4">
            <h4 className="font-medium text-sm text-text-heading">New Character Update</h4>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Module Type"
                value={newDraft.module_type}
                onChange={(e) => setNewDraft({ ...newDraft, module_type: e.target.value as 'abilities' | 'skills' | 'inventory' | 'currency' })}
                required
              >
                {MODULE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>

              <Input
                label="Field Name"
                value={newDraft.field_name}
                onChange={(e) => setNewDraft({ ...newDraft, field_name: e.target.value })}
                placeholder="e.g., strength, lockpicking"
                required
              />

              <Input
                label="Field Value"
                value={newDraft.field_value}
                onChange={(e) => setNewDraft({ ...newDraft, field_value: e.target.value })}
                placeholder="e.g., 18, Expert"
                required
              />

              <Select
                label="Field Type"
                value={newDraft.field_type}
                onChange={(e) => setNewDraft({ ...newDraft, field_type: e.target.value as 'text' | 'number' | 'boolean' | 'json' })}
                required
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>

              <Select
                label="Operation"
                value={newDraft.operation}
                onChange={(e) => setNewDraft({ ...newDraft, operation: e.target.value as 'upsert' | 'delete' })}
                required
                className="col-span-2"
              >
                {OPERATIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsAddingNew(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={createDraft.isPending}>
                Create Update
              </Button>
            </div>
          </form>
        )}

        {/* Existing Drafts List */}
        {drafts && drafts.length > 0 ? (
          <div className="space-y-3">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="p-4 bg-bg-secondary rounded-lg border border-border-primary"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex gap-2 items-center">
                    <Badge variant="primary">{draft.module_type}</Badge>
                    <Badge variant={draft.operation === 'upsert' ? 'success' : 'danger'}>
                      {draft.operation}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {editingDraftId === draft.id ? (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSaveEdit(draft.id)}
                          loading={updateDraft.isPending}
                        >
                          Save
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleStartEdit(draft)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(draft.id)}
                          loading={deleteDraft.isPending}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-text-secondary">Field:</span>
                    <span className="ml-2 text-text-primary font-medium">{draft.field_name}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Type:</span>
                    <span className="ml-2 text-text-primary">{draft.field_type}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-secondary">Value:</span>
                    {editingDraftId === draft.id ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <span className="ml-2 text-text-primary font-medium">{draft.field_value}</span>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-text-secondary">
                  Updated: {new Date(draft.updated_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-text-secondary">
            No draft character updates yet. Click "Add Update" to create one.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
