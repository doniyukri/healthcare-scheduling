import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../common/errors/domain.error.js';
import {
  isAuthenticatedUser,
  VALIDATE_TOKEN_QUERY,
  type AuthGraphqlResponse,
  type AuthenticatedUser,
} from './auth-client.types.js';

/**
 * Delegates authentication to the Auth Service over its versioned GraphQL
 * contract. The Schedule Service never shares the JWT secret: it trusts only a
 * successful `validateToken` response.
 */
@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: ConfigService) {
    this.url = config.getOrThrow<string>('AUTH_SERVICE_URL');
    this.timeoutMs = config.getOrThrow<number>('AUTH_SERVICE_TIMEOUT_MS');
    this.maxRetries = config.getOrThrow<number>('AUTH_SERVICE_MAX_RETRIES');
  }

  async validateToken(token: string): Promise<AuthenticatedUser> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        return await this.request(token);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'UNAUTHORIZED') {
          throw error;
        }

        lastError = error;

        if (attempt < this.maxRetries) {
          const delay = 100 * 2 ** attempt;
          this.logger.warn(
            `Auth Service call failed (attempt ${attempt + 1}/${this.maxRetries + 1}); retrying in ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.logger.error(
      `Auth Service unavailable after ${this.maxRetries + 1} attempt(s): ${
        lastError instanceof Error ? lastError.message : 'unknown error'
      }`,
    );

    throw new DomainError(
      'AUTH_SERVICE_UNAVAILABLE',
      'Authentication service is temporarily unavailable',
      503,
    );
  }

  private async request(token: string): Promise<AuthenticatedUser> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: VALIDATE_TOKEN_QUERY,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const body = (await response.json().catch(() => null)) as AuthGraphqlResponse | null;

    if (response.status === 401 || body?.errors?.some((e) => e.extensions?.code === 'UNAUTHORIZED')) {
      throw new DomainError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    if (!response.ok) {
      throw new Error(`Auth Service responded with HTTP ${response.status}`);
    }

    const user = body?.data?.validateToken;

    if (!isAuthenticatedUser(user)) {
      throw new Error('Auth Service returned a malformed validateToken payload');
    }

    return user;
  }
}
