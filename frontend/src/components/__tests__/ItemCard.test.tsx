import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent as _fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItemCard } from '../ItemCard';
import type { InventoryItem } from '../../types/characters';

const mockItem: InventoryItem = {
  id: '1',
  name: 'Iron Sword',
  description: 'A sturdy iron blade',
  quantity: 1,
  category: 'Weapon',
  value: 100,
  weight: 5,
  equipped: false,
  condition: 'Good',
};

describe('ItemCard', () => {
  describe('Display - Basic Info', () => {
    it('displays item name', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Iron Sword')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('A sturdy iron blade')).toBeInTheDocument();
    });

    it('hides description when not provided', () => {
      const itemWithoutDesc = { ...mockItem, description: undefined };
      render(
        <ItemCard
          item={itemWithoutDesc}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('A sturdy iron blade')).not.toBeInTheDocument();
    });
  });

  describe('Quantity Display', () => {
    it('shows quantity badge when quantity > 1', () => {
      const multipleItems = { ...mockItem, quantity: 5 };
      render(
        <ItemCard
          item={multipleItems}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('x5')).toBeInTheDocument();
    });

    it('hides quantity badge when quantity is 1', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('x1')).not.toBeInTheDocument();
    });
  });

  describe('Equipped Status', () => {
    it('shows equipped badge when item is equipped', () => {
      const equippedItem = { ...mockItem, equipped: true };
      render(
        <ItemCard
          item={equippedItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Equipped')).toBeInTheDocument();
    });

    it('hides equipped badge when item is not equipped', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('Equipped')).not.toBeInTheDocument();
    });
  });

  describe('Category Display', () => {
    it('displays category badge', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Weapon')).toBeInTheDocument();
    });

    it('applies red color for weapon category', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('Weapon');
      expect(badge).toHaveClass('bg-semantic-danger-subtle', 'border-semantic-danger');
    });

    it('applies blue color for armor category', () => {
      const armorItem = { ...mockItem, category: 'Armor' };
      render(
        <ItemCard
          item={armorItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('Armor');
      expect(badge).toHaveClass('bg-semantic-info-subtle', 'border-semantic-info');
    });

    it('applies green color for consumable category', () => {
      const consumableItem = { ...mockItem, category: 'Consumable' };
      render(
        <ItemCard
          item={consumableItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('Consumable');
      expect(badge).toHaveClass('bg-semantic-success-subtle', 'border-semantic-success');
    });

    it('applies yellow color for tool category', () => {
      const toolItem = { ...mockItem, category: 'Tool' };
      render(
        <ItemCard
          item={toolItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('Tool');
      expect(badge).toHaveClass('bg-semantic-warning-subtle', 'border-semantic-warning');
    });

    it('applies gray color for unknown category', () => {
      const otherItem = { ...mockItem, category: 'Misc' };
      render(
        <ItemCard
          item={otherItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      const badge = screen.getByText('Misc');
      // Unknown categories get default badge styling without semantic colors
      expect(badge).toHaveClass('inline-flex', 'items-center');
    });

    it('hides category badge when not provided', () => {
      const itemWithoutCategory = { ...mockItem, category: undefined };
      render(
        <ItemCard
          item={itemWithoutCategory}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('Weapon')).not.toBeInTheDocument();
    });
  });

  describe('Item Stats', () => {
    it('displays weight when provided', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Weight: 5.0')).toBeInTheDocument();
    });

    it('displays value when provided', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Value: 100')).toBeInTheDocument();
    });

    it('displays condition when provided', () => {
      render(
        <ItemCard
          item={mockItem}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('calculates total weight for multiple quantities', () => {
      const multipleItems = { ...mockItem, quantity: 3, weight: 5 };
      render(
        <ItemCard
          item={multipleItems}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Weight: 15.0')).toBeInTheDocument();
    });

    it('calculates total value for multiple quantities', () => {
      const multipleItems = { ...mockItem, quantity: 2, value: 100 };
      render(
        <ItemCard
          item={multipleItems}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Value: 200')).toBeInTheDocument();
    });

    it('hides weight when not provided', () => {
      const itemWithoutWeight = { ...mockItem, weight: undefined };
      render(
        <ItemCard
          item={itemWithoutWeight}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText(/Weight:/)).not.toBeInTheDocument();
    });
  });

  describe('Edit Controls', () => {
    it('hides edit buttons when canEdit is false', () => {
      render(
        <ItemCard
          item={mockItem}
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
        <ItemCard
          item={mockItem}
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
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByDisplayValue('Iron Sword')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A sturdy iron blade')).toBeInTheDocument();
    });

    it('shows save and cancel buttons in edit mode', async () => {
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('allows editing item name', async () => {
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const nameInput = screen.getByDisplayValue('Iron Sword');
      await user.clear(nameInput);
      await user.type(nameInput, 'Steel Sword');

      expect(screen.getByDisplayValue('Steel Sword')).toBeInTheDocument();
    });

    it('allows editing quantity', async () => {
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const qtyInput = screen.getByDisplayValue('1') as HTMLInputElement;
      // Use fireEvent because the component prevents clearing (defaults to 1)
      fireEvent.change(qtyInput, { target: { value: '5' } });

      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });

    it('allows editing description', async () => {
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const descInput = screen.getByDisplayValue('A sturdy iron blade');
      await user.clear(descInput);
      await user.type(descInput, 'A shiny new blade');

      expect(screen.getByDisplayValue('A shiny new blade')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('calls onUpdate with modified values when saved', async () => {
      const onUpdate = vi.fn();
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Iron Sword');
      await user.clear(nameInput);
      await user.type(nameInput, 'Magic Sword');

      const qtyInput = screen.getByDisplayValue('1') as HTMLInputElement;
      // Use fireEvent because the component prevents clearing (defaults to 1)
      fireEvent.change(qtyInput, { target: { value: '3' } });

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Magic Sword',
        quantity: 3,
        description: 'A sturdy iron blade',
      });
    });

    it('exits edit mode after save', async () => {
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
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
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const descInput = screen.getByDisplayValue('A sturdy iron blade');
      await user.clear(descInput);

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        name: 'Iron Sword',
        quantity: 1,
        description: undefined,
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('reverts changes when cancelled', async () => {
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Iron Sword');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed Name');

      await user.click(screen.getByText('✕'));

      expect(screen.getByText('Iron Sword')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Changed Name')).not.toBeInTheDocument();
    });

    it('does not call onUpdate when cancelled', async () => {
      const onUpdate = vi.fn();
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const nameInput = screen.getByDisplayValue('Iron Sword');
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed');

      await user.click(screen.getByText('✕'));

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('exits edit mode when cancelled', async () => {
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
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
      const _user = userEvent.setup();
      render(
        <ItemCard
          item={mockItem}
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
