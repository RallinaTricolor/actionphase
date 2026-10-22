import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { createAppError, extractApiErrorMessage, userFacingApiMessage } from './errors';
import { ERROR_MESSAGES } from '../types/errors';

/**
 * The API emits one error shape: RFC 7807 `{type, title, status, detail}`.
 *
 * The failure this guards against is silent: RFC 7807's `status` is a number,
 * so a fallback chain that reaches it renders a bare "422" to the user without
 * throwing. Nothing here can be asserted by status code alone.
 */

function axios422(data: unknown): AxiosError {
  const err = new AxiosError('Request failed with status code 422');
  err.response = { status: 422, data } as AxiosError['response'];
  return err;
}

describe('extractApiErrorMessage', () => {
  it('ignores a stray legacy error field', () => {
    // No endpoint emits `error` any more. If one regresses, `detail` is still
    // absent, so the caller must fall back rather than surface a half-migrated
    // body -- and must never reach for `status`.
    expect(
      extractApiErrorMessage(axios422({ status: 422, error: 'title is required' }))
    ).toBeUndefined();
  });

  it('reads the RFC 7807 detail field', () => {
    expect(
      extractApiErrorMessage(
        axios422({ type: 'about:blank', title: 'Unprocessable Entity', status: 422, detail: 'title is required' })
      )
    ).toBe('title is required');
  });

  it('prefers field-level messages over a generic "validation failed" detail', () => {
    // Regression: a GM whose game description was too short saw only
    // "validation failed", with no hint of which field or why.
    expect(
      extractApiErrorMessage(
        axios422({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'validation failed',
          errors: [
            { message: 'Description must be at least 10 characters', location: 'body.description' },
            { message: 'Title is required', location: 'body' },
          ],
        })
      )
    ).toBe('Description must be at least 10 characters. Title is required');
  });

  it('prefers a specific detail over the errors array', () => {
    // The backend summarises field errors into detail; when it has, detail is
    // the one to show.
    expect(
      extractApiErrorMessage(
        axios422({
          detail: 'Description must be at least 10 characters',
          errors: [{ message: 'Description must be at least 10 characters', location: 'body.description' }],
        })
      )
    ).toBe('Description must be at least 10 characters');
  });

  it('still shows a generic detail when there is nothing more specific', () => {
    expect(extractApiErrorMessage(axios422({ detail: 'validation failed' }))).toBe('validation failed');
  });

  it('falls back to the errors array when detail is absent', () => {
    expect(
      extractApiErrorMessage(
        axios422({
          title: 'Unprocessable Entity',
          status: 422,
          errors: [
            { message: 'expected length >= 8', location: 'body.password' },
            { message: 'expected a valid email', location: 'body.email' },
          ],
        })
      )
    ).toBe('expected length >= 8. expected a valid email');
  });

  it('never returns the numeric status as a message', () => {
    // The core trap: a 7807 body with no usable prose must yield undefined,
    // not the number 422, so callers apply their own fallback.
    expect(extractApiErrorMessage(axios422({ status: 422 }))).toBeUndefined();
  });

  it('ignores blank and whitespace-only messages', () => {
    expect(extractApiErrorMessage(axios422({ detail: '   ' }))).toBeUndefined();
    expect(extractApiErrorMessage(axios422({ detail: '' }))).toBeUndefined();
    expect(extractApiErrorMessage(axios422({ title: '  ' }))).toBeUndefined();
  });

  it('returns undefined for non-API errors', () => {
    expect(extractApiErrorMessage(new Error('boom'))).toBeUndefined();
    expect(extractApiErrorMessage(null)).toBeUndefined();
    expect(extractApiErrorMessage(undefined)).toBeUndefined();
    expect(extractApiErrorMessage('a string')).toBeUndefined();
  });

  it('accepts a bare response body as well as an axios error', () => {
    expect(extractApiErrorMessage({ detail: 'already taken' })).toBe('already taken');
  });
});

describe('createAppError fallbacks', () => {
  function axiosWithStatus(status: number, data: unknown): AxiosError {
    const err = new AxiosError(`Request failed with status code ${status}`);
    err.response = { status, data } as AxiosError['response'];
    return err;
  }

  it('shows the session-expired message for a 401 carrying no detail', () => {
    // Guards the regression where a truthy numeric `status` suppressed this
    // fallback, leaving the user with a bare "401".
    const appError = createAppError(axiosWithStatus(401, { status: 401, title: '' }));
    expect(appError.context?.userMessage).toBe(ERROR_MESSAGES.SESSION_EXPIRED);
  });

  it('shows the unauthorized message for a 403 carrying no detail', () => {
    const appError = createAppError(axiosWithStatus(403, { status: 403, title: '' }));
    expect(appError.context?.userMessage).toBe(ERROR_MESSAGES.UNAUTHORIZED);
  });

  it('prefers the server detail over the generic fallback on a 403', () => {
    const appError = createAppError(
      axiosWithStatus(403, { status: 403, detail: 'you are banned from this community' })
    );
    expect(appError.context?.userMessage).toBe('you are banned from this community');
  });

  it('falls back to the default 403 message when the body carries no detail', () => {
    const appError = createAppError(axiosWithStatus(403, { status: 403 }));
    expect(appError.context?.userMessage).toBe(ERROR_MESSAGES.UNAUTHORIZED);
  });
});

/**
 * Payloads captured verbatim from the running API after the backend adopted
 * RFC 7807, one per emitter. The API has five independent error emitters -- the
 * jwt middleware, chi/render for other middleware, huma for handlers, the
 * tollbooth rate limiter, and the panic recovery middleware --
 * and they can drift apart without any of them failing on its own. Pinning a
 * real body from each is what catches that.
 */
describe('extractApiErrorMessage against live API payloads', () => {
  it('reads a 401 from the jwt middleware', () => {
    expect(
      extractApiErrorMessage({
        response: {
          data: {
            title: 'Unauthorized',
            status: 401,
            detail: 'no token found',
            instance: 'urn:actionphase:correlation:corr_7bcd73cd936d3896',
          },
        },
      })
    ).toBe('no token found');
  });

  it('reads a 403 from the admin middleware (chi/render)', () => {
    expect(
      extractApiErrorMessage({
        response: {
          data: { title: 'Forbidden', status: 403, detail: 'admin privileges required' },
        },
      })
    ).toBe('admin privileges required');
  });

  it('withholds a 429 from the rate limiter', () => {
    // tollbooth takes a fixed string, so this body alone carries no
    // `instance` -- the one emitter that cannot. Its detail names the rate
    // limit, which must never reach a user; the body's own `status` is what
    // withholds it when the caller passes only the response.
    expect(
      extractApiErrorMessage({
        response: {
          data: {
            title: 'Too Many Requests',
            status: 429,
            detail: 'Rate limit exceeded. Please try again later.',
          },
        },
      })
    ).toBeUndefined();
  });

  it('withholds a 500 from the panic recovery middleware', () => {
    // Shape asserted server-side by
    // TestErrorRecoveryMiddleware_EmitsProblemJSON; there is deliberately no
    // route that panics on demand to capture this from a live server.
    expect(
      extractApiErrorMessage({
        response: {
          data: {
            title: 'Internal Server Error',
            status: 500,
            detail: 'Internal server error',
            instance: 'urn:actionphase:correlation:corr_1f2a9c4b7e0d5a63',
          },
        },
      })
    ).toBeUndefined();
  });

  it('reads a 404 from a huma handler', () => {
    expect(
      extractApiErrorMessage({
        response: {
          data: { title: 'Not Found', status: 404, detail: 'game with ID 999999 not found' },
        },
      })
    ).toBe('game with ID 999999 not found');
  });

  it('reads a 422 carrying field-level errors', () => {
    expect(
      extractApiErrorMessage({
        response: {
          data: {
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'validation failed',
            errors: [
              { message: 'Title must be at least 3 characters', location: 'body.title', value: '' },
              { message: 'Description is required', location: 'body.description' },
            ],
          },
        },
      })
    ).toBe('Title must be at least 3 characters. Description is required');
  });

  it('never renders the numeric status as the message', () => {
    // The trap this whole migration exists to defuse: `status` is a number in
    // RFC 7807, so a fallback chain reaching it shows the user a bare "422".
    for (const status of [401, 403, 404, 422, 500]) {
      expect(extractApiErrorMessage({ response: { data: { status } } })).toBeUndefined();
    }
  });
});

describe('userFacingApiMessage', () => {
  function failed(status: number, data: unknown): AxiosError {
    const err = new AxiosError(`Request failed with status code ${status}`);
    err.response = { status, data } as AxiosError['response'];
    return err;
  }

  it('uses what the server said', () => {
    expect(userFacingApiMessage(400, failed(400, { detail: 'That phase has already ended' })))
      .toBe('That phase has already ended');
  });

  it('never returns axios\' "Request failed with status code" text', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 502]) {
      expect(userFacingApiMessage(status, failed(status, '<html>proxy error</html>')))
        .not.toMatch(/status code/i);
    }
  });

  it('falls back to a plain-language line for an empty 404', () => {
    expect(userFacingApiMessage(404, failed(404, ''))).toMatch(/could not be found/i);
  });

  it('never shows a 5xx detail, which may carry internal error text', () => {
    expect(userFacingApiMessage(500, failed(500, { detail: 'pq: relation "games" does not exist' })))
      .toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
  });

  it('never reveals rate limiting', () => {
    const limited = failed(429, { title: 'Too Many Requests', status: 429, detail: 'Rate limit exceeded. Please try again later.' });
    expect(userFacingApiMessage(429, limited)).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
    expect(userFacingApiMessage(429, failed(429, ''))).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
  });

  // Regression: components that call extractApiErrorMessage directly
  // (CreateGameForm and ~20 others) showed a 5xx or 429 detail verbatim.
  it('withholds a 5xx or 429 detail from direct extractApiErrorMessage callers', () => {
    for (const status of [429, 500, 502, 503]) {
      expect(extractApiErrorMessage(failed(status, { detail: 'pq: connection refused' })), `status ${status}`)
        .toBeUndefined();
    }
  });

  // Regression: createAppError worded statuses itself and disagreed with this
  // (an empty 404 or 429 read "An unexpected error occurred"), so the text a
  // user saw depended on which helper a component happened to call.
  it('agrees with createAppError for every status, with and without a server message', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429, 500, 501, 502, 503]) {
      for (const data of ['', { detail: 'That phase has already ended' }]) {
        const error = failed(status, data);
        expect(createAppError(error).context?.userMessage, `status ${status}`)
          .toBe(userFacingApiMessage(status, error));
      }
    }
  });
});
