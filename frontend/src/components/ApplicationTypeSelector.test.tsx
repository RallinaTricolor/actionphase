import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApplicationTypeSelector } from './ApplicationTypeSelector';

describe('ApplicationTypeSelector', () => {
  describe('during recruitment', () => {
    it('shows both player and audience options', () => {
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="recruitment"
          selectedType="player"
          onTypeChange={mockOnTypeChange}
        />
      );

      expect(screen.getByLabelText('Player')).toBeInTheDocument();
      expect(screen.getByLabelText('Audience')).toBeInTheDocument();
      expect(screen.getByText('Application Type')).toBeInTheDocument();
    });

    it('player radio is checked when selectedType is player', () => {
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="recruitment"
          selectedType="player"
          onTypeChange={mockOnTypeChange}
        />
      );

      const playerRadio = screen.getByLabelText('Player');
      const audienceRadio = screen.getByLabelText('Audience');

      expect(playerRadio).toBeChecked();
      expect(audienceRadio).not.toBeChecked();
    });

    it('audience radio is checked when selectedType is audience', () => {
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="recruitment"
          selectedType="audience"
          onTypeChange={mockOnTypeChange}
        />
      );

      const playerRadio = screen.getByLabelText('Player');
      const audienceRadio = screen.getByLabelText('Audience');

      expect(playerRadio).not.toBeChecked();
      expect(audienceRadio).toBeChecked();
    });

    it('calls onTypeChange with player when player radio is clicked', async () => {
      const user = userEvent.setup();
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="recruitment"
          selectedType="audience"
          onTypeChange={mockOnTypeChange}
        />
      );

      const playerRadio = screen.getByLabelText('Player');
      await user.click(playerRadio);

      expect(mockOnTypeChange).toHaveBeenCalledWith('player');
    });

    it('calls onTypeChange with audience when audience radio is clicked', async () => {
      const user = userEvent.setup();
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="recruitment"
          selectedType="player"
          onTypeChange={mockOnTypeChange}
        />
      );

      const audienceRadio = screen.getByLabelText('Audience');
      await user.click(audienceRadio);

      expect(mockOnTypeChange).toHaveBeenCalledWith('audience');
    });
  });

  describe('after recruitment ends', () => {
    it('only shows audience option', () => {
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="in_progress"
          selectedType="audience"
          onTypeChange={mockOnTypeChange}
        />
      );

      expect(screen.queryByLabelText('Player')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Audience')).toBeInTheDocument();
    });

    it('shows explanation message about recruitment ending', () => {
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="in_progress"
          selectedType="audience"
          onTypeChange={mockOnTypeChange}
        />
      );

      expect(screen.getByText(/player recruitment has ended/i)).toBeInTheDocument();
      expect(screen.getByText(/you can still join as an audience member/i)).toBeInTheDocument();
    });

    it('audience radio is checked', () => {
      const mockOnTypeChange = vi.fn();

      render(
        <ApplicationTypeSelector
          gameState="in_progress"
          selectedType="audience"
          onTypeChange={mockOnTypeChange}
        />
      );

      const audienceRadio = screen.getByLabelText('Audience');
      expect(audienceRadio).toBeChecked();
    });
  });
});
