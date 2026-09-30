import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, screen } from '@testing-library/react';
import { ToastProvider } from '@/contexts/ToastContext';
import { useOptionalGameContext } from '@/contexts/GameContext';
import { apiClient } from '@/lib/api';
import { useLootRoll } from './useLootRoll';

// GameContext itself is not exported, so drive the optional hook directly: null
// stands in for "rendered outside a GameProvider".
vi.mock('@/contexts/GameContext', () => ({
  useOptionalGameContext: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    games: {
      giveRandomLootTableContent: vi.fn(),
    },
  },
}));

type RollResponse = Awaited<ReturnType<typeof apiClient.games.giveRandomLootTableContent>>;

const withGame = (gameId: number | null) =>
  vi.mocked(useOptionalGameContext).mockReturnValue(
    (gameId === null ? null : { gameId }) as ReturnType<typeof useOptionalGameContext>,
  );

// Toasts render inside the wrapper's provider, so screen queries find them.
const setup = () => {
  const onRolled = vi.fn();
  const { result } = renderHook(() => useLootRoll(5, onRolled), {
    wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
  });
  return { result, onRolled };
};

describe('useLootRoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withGame(42);
  });

  it('offers only manual entry outside a game', () => {
    withGame(null);
    expect(setup().result.current.modes).toEqual(['manual']);
  });

  it('offers every mode inside a game', () => {
    expect(setup().result.current.modes).toEqual(['manual', 'loot_table', 'loot_table_random']);
  });

  it('rolls on the table for this character and hands back the rolled entry', async () => {
    vi.mocked(apiClient.games.giveRandomLootTableContent).mockResolvedValue({
      data: { id: 1, name: 'Gold Ring', data: '{"name":"Gold Ring","quantity":"2"}' },
    } as RollResponse);
    const { result, onRolled } = setup();

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.roll(7); });

    expect(apiClient.games.giveRandomLootTableContent).toHaveBeenCalledWith(42, 7, 5);
    // Verbatim: the server already wrote this, so nothing is coerced or re-saved.
    expect(onRolled).toHaveBeenCalledWith({ name: 'Gold Ring', quantity: '2' });
    expect(ok).toBe(true);
  });

  // Regression: the request had no .catch(), so a failed roll — e.g. the 400
  // returned for an empty loot table — left the modal open with no feedback.
  it('surfaces the server error message when the roll fails', async () => {
    vi.mocked(apiClient.games.giveRandomLootTableContent).mockRejectedValue({
      response: { data: { detail: 'loot table is empty: add at least one item before rolling' } },
    });
    const { result, onRolled } = setup();

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.roll(7); });

    expect(ok).toBe(false);
    expect(onRolled).not.toHaveBeenCalled();
    expect(await screen.findByText(/loot table is empty/i)).toBeInTheDocument();
  });

  it('falls back to a generic message when the error carries no server text', async () => {
    vi.mocked(apiClient.games.giveRandomLootTableContent).mockRejectedValue(new Error('Network down'));
    const { result } = setup();

    await act(async () => { await result.current.roll(7); });

    expect(await screen.findByText(/failed to roll/i)).toBeInTheDocument();
  });

  it.each([
    ['not JSON', 'not json'],
    ['JSON but not an object', '"just a string"'],
  ])('reports malformed item data (%s) instead of throwing', async (_label, data) => {
    vi.mocked(apiClient.games.giveRandomLootTableContent).mockResolvedValue({
      data: { id: 1, name: 'Broken Item', data },
    } as RollResponse);
    const { result, onRolled } = setup();

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.roll(7); });

    expect(ok).toBe(false);
    expect(onRolled).not.toHaveBeenCalled();
    expect(await screen.findByText(/malformed/i)).toBeInTheDocument();
  });

  it('refuses to roll outside a game', async () => {
    withGame(null);
    const { result } = setup();

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.roll(7); });

    expect(ok).toBe(false);
    expect(apiClient.games.giveRandomLootTableContent).not.toHaveBeenCalled();
  });
});
