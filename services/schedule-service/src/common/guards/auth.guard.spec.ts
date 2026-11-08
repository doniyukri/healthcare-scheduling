import { jest } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthClientService } from '../../auth-client/auth-client.service.js';
import { AuthGuard, extractBearerToken } from './auth.guard.js';

function createContext(options: {
  type?: 'graphql' | 'http';
  authorization?: string;
  fieldName?: string;
}): { context: ExecutionContext; gqlContext: Record<string, unknown> } {
  const gqlContext: Record<string, unknown> = {
    req: { headers: options.authorization ? { authorization: options.authorization } : {} },
  };
  const info = { fieldName: options.fieldName ?? 'customers' };

  const context = {
    getType: () => options.type ?? 'graphql',
    getArgs: () => [null, null, gqlContext, info],
    getClass: () => class {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
  } as unknown as ExecutionContext;

  return { context, gqlContext };
}

function createGuard(validateToken = jest.fn()) {
  return {
    guard: new AuthGuard({ validateToken } as unknown as AuthClientService),
    validateToken,
  };
}

describe('extractBearerToken', () => {
  it('extracts a well-formed bearer token', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('bearer token')).toBe('token');
  });

  it('rejects missing, malformed and multi-value headers', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer a b')).toBeNull();
  });

  it('uses the first value when the header is an array', () => {
    expect(extractBearerToken(['Bearer first', 'Bearer second'])).toBe('first');
  });
});

describe('AuthGuard', () => {
  it('allows non-GraphQL contexts such as health checks', async () => {
    const { guard, validateToken } = createGuard();
    const { context } = createContext({ type: 'http' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(validateToken).not.toHaveBeenCalled();
  });

  it('allows schema introspection without a token', async () => {
    const { guard, validateToken } = createGuard();
    const { context } = createContext({ fieldName: '__schema' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(validateToken).not.toHaveBeenCalled();
  });

  it('rejects a missing token', async () => {
    const { guard } = createGuard();
    const { context } = createContext({});

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('rejects a malformed authorization header', async () => {
    const { guard } = createGuard();
    const { context } = createContext({ authorization: 'Token abc' });

    await expect(guard.canActivate(context)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('stores the authenticated user in the GraphQL context', async () => {
    const user = { id: 'user-1', email: 'user@example.com' };
    const { guard, validateToken } = createGuard(jest.fn().mockResolvedValue(user));
    const { context, gqlContext } = createContext({ authorization: 'Bearer valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(validateToken).toHaveBeenCalledWith('valid-token');
    expect(gqlContext.user).toEqual(user);
  });

  it('propagates an UNAUTHORIZED error from the auth client', async () => {
    const error = Object.assign(new Error('Invalid token'), { code: 'UNAUTHORIZED' });
    const { guard } = createGuard(jest.fn().mockRejectedValue(error));
    const { context } = createContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toBe(error);
  });
});
