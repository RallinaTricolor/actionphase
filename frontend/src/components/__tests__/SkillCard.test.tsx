import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillCard } from '../SkillCard';
import type { CharacterSkill } from '../../types/characters';

const mockSkill: CharacterSkill = {
  id: '1',
  name: 'Swordsmanship',
  level: 'Expert',
  description: 'Mastery of blade combat',
  category: 'Combat',
};

describe('SkillCard', () => {
  describe('Display - Basic Info', () => {
    it('displays skill name', () => {
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Swordsmanship')).toBeInTheDocument();
    });

    it('displays level when provided', () => {
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Level: Expert')).toBeInTheDocument();
    });

    it('hides level when not provided', () => {
      const skillWithoutLevel = { ...mockSkill, level: undefined };
      render(
        <SkillCard
          skill={skillWithoutLevel}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText(/Level:/)).not.toBeInTheDocument();
    });

    it('displays numeric level', () => {
      const skillWithNumericLevel = { ...mockSkill, level: 5 };
      render(
        <SkillCard
          skill={skillWithNumericLevel}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Level: 5')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Mastery of blade combat')).toBeInTheDocument();
    });

    it('hides description when not provided', () => {
      const skillWithoutDesc = { ...mockSkill, description: undefined };
      render(
        <SkillCard
          skill={skillWithoutDesc}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('Mastery of blade combat')).not.toBeInTheDocument();
    });
  });

  describe('Category Display', () => {
    it('displays category badge when provided', () => {
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Combat')).toBeInTheDocument();
    });

    it('hides category badge when not provided', () => {
      const skillWithoutCategory = { ...mockSkill, category: undefined };
      render(
        <SkillCard
          skill={skillWithoutCategory}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('Combat')).not.toBeInTheDocument();
    });
  });

  describe('Edit Controls', () => {
    it('hides edit buttons when canEdit is false', () => {
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('✎')).not.toBeInTheDocument();
      expect(screen.queryByText('🗑')).not.toBeInTheDocument();
    });

    it('shows edit buttons when canEdit is true', () => {
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('✎')).toBeInTheDocument();
      expect(screen.getByText('🗑')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('enters edit mode when edit button clicked', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByDisplayValue('Swordsmanship')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Expert')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Mastery of blade combat')).toBeInTheDocument();
    });

    it('shows save and cancel buttons in edit mode', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('allows editing skill name', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const nameInput = screen.getByDisplayValue('Swordsmanship');
      await user.clear(nameInput);
      await user.type(nameInput, 'Archery');

      expect(screen.getByDisplayValue('Archery')).toBeInTheDocument();
    });

    it('allows editing level', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const levelInput = screen.getByDisplayValue('Expert');
      await user.clear(levelInput);
      await user.type(levelInput, 'Master');

      expect(screen.getByDisplayValue('Master')).toBeInTheDocument();
    });

    it('allows editing description', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const descInput = screen.getByDisplayValue('Mastery of blade combat');
      await user.clear(descInput);
      await user.type(descInput, 'Advanced weapon techniques');

      expect(screen.getByDisplayValue('Advanced weapon techniques')).toBeInTheDocument();
    });

    it('shows level placeholder text', async () => {
      const skillWithoutLevel = { ...mockSkill, level: undefined };
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={skillWithoutLevel}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByPlaceholderText('Level (e.g., Expert, 5, Advanced)')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('calls onUpdate with modified values when saved', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Swordsmanship');
      await user.clear(nameInput);
      await user.type(nameInput, 'Archery');

      const levelInput = screen.getByDisplayValue('Expert');
      await user.clear(levelInput);
      await user.type(levelInput, 'Novice');

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Archery',
        level: 'Novice',
        description: 'Mastery of blade combat',
      });
    });

    it('exits edit mode after save', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      await user.click(screen.getByText('✓'));

      expect(screen.queryByText('✓')).not.toBeInTheDocument();
      expect(screen.getByText('✎')).toBeInTheDocument();
    });

    it('sets level to undefined when empty', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const levelInput = screen.getByDisplayValue('Expert');
      await user.clear(levelInput);

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Swordsmanship',
        level: undefined,
        description: 'Mastery of blade combat',
      });
    });

    it('sets description to undefined when empty', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const descInput = screen.getByDisplayValue('Mastery of blade combat');
      await user.clear(descInput);

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Swordsmanship',
        level: 'Expert',
        description: undefined,
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('reverts changes when cancelled', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Swordsmanship');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed Name');

      await user.click(screen.getByText('✕'));

      expect(screen.getByText('Swordsmanship')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Changed Name')).not.toBeInTheDocument();
    });

    it('does not call onUpdate when cancelled', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Swordsmanship');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed');

      await user.click(screen.getByText('✕'));

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('exits edit mode when cancelled', async () => {
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      await user.click(screen.getByText('✕'));

      expect(screen.queryByText('✕')).not.toBeInTheDocument();
      expect(screen.getByText('✎')).toBeInTheDocument();
    });
  });

  describe('Remove Functionality', () => {
    it('calls onRemove when delete button clicked', async () => {
      const onRemove = vi.fn();
      const user = userEvent.setup();
      render(
        <SkillCard
          skill={mockSkill}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={onRemove}
        />
      );

      await user.click(screen.getByText('🗑'));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
