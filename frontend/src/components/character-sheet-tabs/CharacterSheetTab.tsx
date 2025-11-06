import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Input, Textarea, Select, Badge, Card, CardBody, Alert } from '../ui';
import { useCreateDraftCharacterUpdate } from '../../hooks';
import type { DraftCharacterUpdate } from '../../types/phases';

type ModuleType = 'abilities' | 'skills' | 'inventory' | 'currency';
type FieldType = 'text' | 'number' | 'json';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  placeholder?: string;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  gridColumn?: 'full' | 'half';
}

interface CharacterSheetTabProps {
  gameId: number;
  actionResultId: number;
  characterId: number;
  drafts: DraftCharacterUpdate[];
  onDeleteDraft: (draftId: number) => void;

  // Configuration
  moduleType: ModuleType;
  title: string;
  addButtonLabel: string;
  emptyMessage: string;

  // Form configuration
  formFields: FormField[];

  // Value transformation functions
  buildFieldValue: (formData: Record<string, any>) => string;
  buildFieldName: (formData: Record<string, any>) => string;
  getFieldType: () => FieldType;

  // Render functions for draft display
  renderDraftContent: (draft: DraftCharacterUpdate) => ReactNode;

  // Optional: Custom validation
  validateForm?: (formData: Record<string, any>) => string | null;
}

export const CharacterSheetTab: React.FC<CharacterSheetTabProps> = ({
  gameId,
  actionResultId,
  characterId,
  drafts,
  onDeleteDraft,
  moduleType,
  title,
  addButtonLabel,
  emptyMessage,
  formFields,
  buildFieldValue,
  buildFieldName,
  getFieldType,
  renderDraftContent,
  validateForm,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const createDraft = useCreateDraftCharacterUpdate(gameId, actionResultId);

  // Initialize form data with default values
  const initializeForm = () => {
    const initialData: Record<string, any> = {};
    formFields.forEach(field => {
      initialData[field.name] = field.type === 'number' ? '0' : '';
    });
    setFormData(initialData);
  };

  const handleAdd = async () => {
    // Custom validation if provided
    if (validateForm) {
      const validationError = validateForm(formData);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Default validation: check required fields
    const hasRequiredFields = formFields
      .filter(field => field.required)
      .every(field => {
        const value = formData[field.name];
        return value && value.toString().trim();
      });

    if (!hasRequiredFields) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await createDraft.mutateAsync({
        character_id: characterId,
        module_type: moduleType,
        field_name: buildFieldName(formData),
        field_value: buildFieldValue(formData),
        field_type: getFieldType(),
        operation: 'upsert',
      });

      // Reset form
      initializeForm();
      setIsAdding(false);
      setError(null);
    } catch (err) {
      console.error(`Failed to add ${moduleType.slice(0, -1)}:`, err);
      setError(`Failed to add ${moduleType.slice(0, -1)}. Please try again.`);
    }
  };

  const handleCancel = () => {
    initializeForm();
    setIsAdding(false);
    setError(null);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const renderFormField = (field: FormField) => {
    const value = formData[field.name] || '';
    const commonProps = {
      label: field.label,
      placeholder: field.placeholder,
      value,
      required: field.required,
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            key={field.name}
            {...commonProps}
            rows={field.rows || 3}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );

      case 'select':
        return (
          <Select
            key={field.name}
            {...commonProps}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          >
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );

      case 'number':
        return (
          <Input
            key={field.name}
            {...commonProps}
            type="number"
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );

      default: // 'text'
        return (
          <Input
            key={field.name}
            {...commonProps}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
          />
        );
    }
  };

  // Start adding when button clicked
  const handleStartAdding = () => {
    initializeForm();
    setIsAdding(true);
  };

  // Separate fields by grid column
  const fullWidthFields = formFields.filter(f => !f.gridColumn || f.gridColumn === 'full');
  const halfWidthFields = formFields.filter(f => f.gridColumn === 'half');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-content-primary">{title}</h3>
        {!isAdding && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartAdding}
          >
            {addButtonLabel}
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="danger" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Add Form */}
      {isAdding && (
        <Card variant="elevated" padding="md">
          <CardBody>
            <div className="space-y-3">
              {/* Full-width fields */}
              {fullWidthFields.map(field => renderFormField(field))}

              {/* Half-width fields in grid */}
              {halfWidthFields.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {halfWidthFields.map(field => renderFormField(field))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleAdd}
                  disabled={createDraft.isPending}
                  data-testid={`add-${moduleType}-button`}
                >
                  {createDraft.isPending ? 'Adding...' : addButtonLabel}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={createDraft.isPending}
                  data-testid={`cancel-${moduleType}-button`}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Drafts List */}
      <div className="space-y-2">
        {drafts.length === 0 && !isAdding && (
          <p className="text-content-secondary text-sm text-center py-8">
            {emptyMessage}
          </p>
        )}

        {drafts.map((draft) => (
          <Card key={draft.id} variant="bordered" padding="sm">
            <CardBody>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-content-primary">
                      {draft.field_name}
                    </span>
                    <Badge variant="warning" className="text-xs">
                      DRAFT
                    </Badge>
                  </div>
                  {renderDraftContent(draft)}
                  <p className="text-xs text-content-tertiary mt-1">
                    Updated: {new Date(draft.updated_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteDraft(draft.id)}
                >
                  Remove
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};
