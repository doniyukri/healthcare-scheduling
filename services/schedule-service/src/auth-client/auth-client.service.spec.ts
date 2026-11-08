import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { AuthClientService } from './auth-client.service.js';

const config = {
  AUTH_SERVICE_URL: 'http://auth-service:3001/graphql',
  AUTH_SERVICE_TIMEOUT_MS: 2000,
  AUTH_SERVICE_MAX_RETRIES: 1,
};

function createService(overrides: Partial<typeof config> = {}): AuthClientService {
  const values = { ...config, ...overrides };
  return new AuthClientService({
    getOrThrow: (key: keyof typeof values) => values[key],
  } as unknown as ConfigService);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('AuthClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns the user from a successful validateToken response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ data: { validateToken: { id: 'user-1', email: 'user@example.com' } } }),
    ) as unknown as typeof fetch;

    await expect(createService().validateToken('token')).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: 'Bearer token' });
  });

  it('maps an HTTP 401 to UNAUTHORIZED without retrying', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ errors: [{ message: 'Invalid token' }] }, 401)) as unknown as typeof fetch;

    await expect(createService().validateToken('token')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('maps a GraphQL UNAUTHORIZED error to UNAUTHORIZED', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        errors: [{ message: 'Invalid token', extensions: { code: 'UNAUTHORIZED' } }],
      }),
    ) as unknown as typeof fetch;

    await expect(createService().validateToken('token')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('retries a transport failure and reports AUTH_SERVICE_UNAVAILABLE', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch;

    await expect(createService({ AUTH_SERVICE_MAX_RETRIES: 1 }).validateToken('token')).rejects.toMatchObject({
      code: 'AUTH_SERVICE_UNAVAILABLE',
      statusCode: 503,
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('treats a malformed payload as unavailable', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ data: { validateToken: { id: 'only-id' } } })) as unknown as typeof fetch;

    await expect(
      createService({ AUTH_SERVICE_MAX_RETRIES: 0 }).validateToken('token'),
    ).rejects.toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE' });
  });

  it('treats a 5xx response as unavailable', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ message: 'boom' }, 500)) as unknown as typeof fetch;

    await expect(
      createService({ AUTH_SERVICE_MAX_RETRIES: 0 }).validateToken('token'),
    ).rejects.toMatchObject({ code: 'AUTH_SERVICE_UNAVAILABLE' });
  });
});
