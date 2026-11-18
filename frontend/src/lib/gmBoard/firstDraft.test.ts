import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { makeActionResult, makeAxiosResponse } from '@/test-utils/factories';
import type { ActionResult } from '@/types/phases';
import { apiClient } from '@/lib/api';
import { createFirstDraft } from './firstDraft';

vi.mock('@/lib/api', () => ({ apiClient: { phases: { createActionResult: vi.fn(), getGameResults: vi.fn() } } }));
const create = vi.mocked(apiClient.phases.createActionResult);
const request = { phase_id: 3, user_id: 100, character_id: 1, content: '' };

describe('createFirstDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shares one request between callers for the same character, and lists the result', async () => {
    create.mockResolvedValue(makeAxiosResponse(makeActionResult({ id: 9 })));
    const qc = new QueryClient();
    qc.setQueryData<ActionResult[]>(['actionResults', 'game', 7], []);

    const [a, b] = await Promise.all([createFirstDraft(qc, 7, request), createFirstDraft(qc, 7, { ...request, content: 'Typed' })]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(7, { ...request, first_draft: true });
    expect(a.id).toBe(9);
    expect(b.id).toBe(9);
    expect(qc.getQueryData<ActionResult[]>(['actionResults', 'game', 7])?.map((r) => r.id)).toEqual([9]);
  });

  it('keeps characters apart, and asks again once a request has finished', async () => {
    create.mockResolvedValue(makeAxiosResponse(makeActionResult({ id: 9 })));
    const qc = new QueryClient();
    await Promise.all([createFirstDraft(qc, 7, request), createFirstDraft(qc, 7, { ...request, character_id: 2 })]);
    expect(create).toHaveBeenCalledTimes(2);
    await createFirstDraft(qc, 7, request);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('lets the next caller try again after a failure', async () => {
    create.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(makeAxiosResponse(makeActionResult({ id: 9 })));
    const qc = new QueryClient();
    await expect(createFirstDraft(qc, 7, request)).rejects.toThrow('down');
    await expect(createFirstDraft(qc, 7, request)).resolves.toMatchObject({ id: 9 });
  });
});
