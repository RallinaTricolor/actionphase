import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { apiClient } from '@/lib/api';

/**
 * Most components show a failed request as `error.message`. Left alone, axios
 * sets that to "Request failed with status code 422", so the response
 * interceptor replaces it with what the server said.
 */
describe('API client error messages', () => {
  it("replaces axios' status-code message with the server's reason", async () => {
    server.use(
      http.get('/api/v1/games/1', () =>
        HttpResponse.json(
          {
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'validation failed',
            errors: [{ message: 'Description must be at least 10 characters', location: 'body.description' }],
          },
          { status: 422 }
        )
      )
    );

    const error = await apiClient.games.getGame(1).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AxiosError);
    expect((error as AxiosError).message).toBe('Description must be at least 10 characters');
    // Callers that read the response body or status are unaffected.
    expect((error as AxiosError).response?.status).toBe(422);
  });

  it('uses a plain-language message when the body says nothing', async () => {
    server.use(http.get('/api/v1/games/1', () => new HttpResponse('<html>Bad Gateway</html>', { status: 502 })));

    const error = (await apiClient.games.getGame(1).catch((e: unknown) => e)) as AxiosError;

    expect(error.message).not.toMatch(/status code/i);
    expect(error.message).toMatch(/try again/i);
  });
});
