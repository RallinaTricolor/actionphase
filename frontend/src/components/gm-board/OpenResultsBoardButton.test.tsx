import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';
import { makeGamePhase } from '@/test-utils/factories';
import { OpenResultsBoardButton } from './OpenResultsBoardButton';

describe('OpenResultsBoardButton', () => {
  it('opens the current action phase’s board', async () => {
    const { router } = renderWithProviders(
      <OpenResultsBoardButton gameId={7} phase={makeGamePhase({ id: 70, phase_type: 'action' })} />,
      { initialRoute: '/games/7?tab=actions' },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open results board' }));
    expect(router.state.location.pathname).toBe('/games/7/phases/70/board');
  });

  it.each(['common_room', 'interlude'] as const)('isn’t offered in a %s phase', (phase_type) => {
    renderWithProviders(<OpenResultsBoardButton gameId={7} phase={makeGamePhase({ phase_type })} />);
    expect(screen.queryByRole('button', { name: 'Open results board' })).not.toBeInTheDocument();
  });

  it('isn’t offered with no phase', () => {
    renderWithProviders(<OpenResultsBoardButton gameId={7} phase={null} />);
    expect(screen.queryByTestId('open-results-board')).not.toBeInTheDocument();
  });
});
