import type { CharacterAbility } from '../types/characters';
import { Modal } from './Modal';
import { AbilityForm, type AbilityFormData } from './character-updates/AbilityForm';

interface AddAbilityModalProps {
  onAdd: (ability: Omit<CharacterAbility, 'id'>) => void;
  onCancel: () => void;
}

export const AddAbilityModal: React.FC<AddAbilityModalProps> = ({ onAdd, onCancel }) => {
  const handleSubmit = (data: AbilityFormData) => {
    onAdd({
      name: data.name,
      description: data.description,
      type: data.type,
      active: true
    });
  };

  return (
    <Modal isOpen={true} onClose={onCancel} title="Add New Ability">
      <AbilityForm
        onSubmit={handleSubmit}
        onCancel={onCancel}
        submitLabel="Add Ability"
        variant="modal"
      />
    </Modal>
  );
};
