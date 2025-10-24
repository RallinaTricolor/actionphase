import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityCard } from '../AbilityCard';
import type { CharacterAbility } from '../../types/characters';

const mockAbility: CharacterAbility = {
  id: '1',
  name: 'Fireball',
  description: 'Hurls a ball of flame',
  type: 'learned',
  active: true,
};

describe('AbilityCard', () => {
  describe('Display - Basic Info', () => {
    it('displays ability name', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Hurls a ball of flame')).toBeInTheDocument();
    });

    it('hides description when not provided', () => {
      const abilityWithoutDesc = { ...mockAbility, description: undefined };
      render(
        <AbilityCard
          ability={abilityWithoutDesc}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('Hurls a ball of flame')).not.toBeInTheDocument();
    });
  });

  describe('Type Badge Display', () => {
    it('displays learned type badge', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('learned')).toBeInTheDocument();
    });

    it('applies blue color for learned type', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('learned');
      expect(badge).toHaveClass('bg-semantic-info-subtle', 'text-content-primary');
    });

    it('applies green color for innate type', () => {
      const innateAbility = { ...mockAbility, type: 'innate' as const };
      render(
        <AbilityCard
          ability={innateAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('innate');
      expect(badge).toHaveClass('bg-semantic-success-subtle', 'text-content-primary');
    });

    it('applies purple color for gm_assigned type', () => {
      const gmAbility = { ...mockAbility, type: 'gm_assigned' as const };
      render(
        <AbilityCard
          ability={gmAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('gm assigned');
      expect(badge).toHaveClass('bg-semantic-warning-subtle', 'text-content-primary');
    });

    it('formats type name with space for gm_assigned', () => {
      const gmAbility = { ...mockAbility, type: 'gm_assigned' as const };
      render(
        <AbilityCard
          ability={gmAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('gm assigned')).toBeInTheDocument();
      expect(screen.queryByText('gm_assigned')).not.toBeInTheDocument();
    });
  });

  describe('Source Display', () => {
    it('displays source when provided', () => {
      const abilityWithSource = { ...mockAbility, source: 'Wizard Class' };
      render(
        <AbilityCard
          ability={abilityWithSource}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Source: Wizard Class')).toBeInTheDocument();
    });

    it('hides source when not provided', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
    });
  });

  describe('Active Status', () => {
    it('hides inactive badge when ability is active', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
    });

    it('shows inactive badge when ability is not active', () => {
      const inactiveAbility = { ...mockAbility, active: false };
      render(
        <AbilityCard
          ability={inactiveAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  describe('Edit Controls - GM Assigned Abilities', () => {
    it('hides edit controls for gm_assigned abilities even when canEdit is true', () => {
      const gmAbility = { ...mockAbility, type: 'gm_assigned' as const };
      render(
        <AbilityCard
          ability={gmAbility}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('✎')).not.toBeInTheDocument();
      expect(screen.queryByText('🗑')).not.toBeInTheDocument();
    });
  });

  describe('Edit Controls - Non-GM Abilities', () => {
    it('hides edit buttons when canEdit is false', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('✎')).not.toBeInTheDocument();
      expect(screen.queryByText('🗑')).not.toBeInTheDocument();
    });

    it('shows edit buttons for learned abilities when canEdit is true', () => {
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('✎')).toBeInTheDocument();
      expect(screen.getByText('🗑')).toBeInTheDocument();
    });

    it('shows edit buttons for innate abilities when canEdit is true', () => {
      const innateAbility = { ...mockAbility, type: 'innate' as const };
      render(
        <AbilityCard
          ability={innateAbility}
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
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByDisplayValue('Fireball')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Hurls a ball of flame')).toBeInTheDocument();
    });

    it('shows save and cancel buttons in edit mode', async () => {
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('allows editing ability name', async () => {
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const nameInput = screen.getByDisplayValue('Fireball');
      await user.clear(nameInput);
      await user.type(nameInput, 'Lightning Bolt');

      expect(screen.getByDisplayValue('Lightning Bolt')).toBeInTheDocument();
    });

    it('allows editing description', async () => {
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const descInput = screen.getByDisplayValue('Hurls a ball of flame');
      await user.clear(descInput);
      await user.type(descInput, 'Shoots a bolt of electricity');

      expect(screen.getByDisplayValue('Shoots a bolt of electricity')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('calls onUpdate with modified values when saved', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Fireball');
      await user.clear(nameInput);
      await user.type(nameInput, 'Ice Shard');

      const descInput = screen.getByDisplayValue('Hurls a ball of flame');
      await user.clear(descInput);
      await user.type(descInput, 'Launches a frozen projectile');

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Ice Shard',
        description: 'Launches a frozen projectile',
      });
    });

    it('exits edit mode after save', async () => {
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
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

    it('sets description to undefined when empty', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const descInput = screen.getByDisplayValue('Hurls a ball of flame');
      await user.clear(descInput);

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Fireball',
        description: undefined,
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('reverts changes when cancelled', async () => {
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Fireball');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed Name');

      await user.click(screen.getByText('✕'));

      expect(screen.getByText('Fireball')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Changed Name')).not.toBeInTheDocument();
    });

    it('does not call onUpdate when cancelled', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Fireball');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed');

      await user.click(screen.getByText('✕'));

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('exits edit mode when cancelled', async () => {
      const user = userEvent.setup();
      render(
        <AbilityCard
          ability={mockAbility}
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
        <AbilityCard
          ability={mockAbility}
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
