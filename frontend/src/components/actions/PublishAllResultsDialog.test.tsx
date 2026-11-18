import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test-utils/render';
import { makeActionResult } from '@/test-utils/factories';
import { PublishAllResultsDialog } from './PublishAllResultsDialog';

const GAME_ID = 7;
const PHASE_ID = 3;

const serveResults = (...results: ReturnType<typeof makeActionResult>[]) =>
  server.use(http.get(`/api/v1/games/${GAME_ID}/results`, () => HttpResponse.json(results)));
const draft = (id: number, content: string, character_name: string, over = {}) =>
  makeActionResult({ id, game_id: GAME_ID, phase_id: PHASE_ID, is_published: false, content, character_name, ...over });

const renderDialog = (error?: unknown) =>
  renderWithProviders(
    <PublishAllResultsDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} gameId={GAME_ID} phaseId={PHASE_ID} count={2} error={error} />,
    { gameId: GAME_ID },
  );

describe('PublishAllResultsDialog', () => {
  it('names who has nothing written, and won’t publish', async () => {
    serveResults(draft(1, 'Written.', 'Mara'), draft(2, '  ', 'Rook'), draft(3, '', 'Other phase', { phase_id: 99 }), draft(4, '', 'Sent', { is_published: true }));
    renderDialog();
    expect(await screen.findByTestId('publish-all-blank-drafts')).toHaveTextContent('Nothing written yet for: Rook.');
    expect(screen.getByRole('button', { name: 'Confirm & Publish' })).toBeDisabled();
  });

  it('can publish when every draft has text', async () => {
    serveResults(draft(1, 'Written.', 'Mara'));
    renderDialog();
    expect(await screen.findByRole('button', { name: 'Confirm & Publish' })).toBeEnabled();
    expect(screen.queryByTestId('publish-all-blank-drafts')).not.toBeInTheDocument();
  });

  it('shows why the server refused', async () => {
    serveResults(draft(1, 'Written.', 'Mara'));
    const headers = new AxiosHeaders();
    renderDialog(new AxiosError('Conflict', '409', { headers }, null, { status: 409, statusText: 'Conflict', headers, config: { headers }, data: { status: 409, title: 'Conflict', detail: 'Nothing was published.' } }));
    expect(await screen.findByText('Nothing was published.')).toBeInTheDocument();
  });
});
