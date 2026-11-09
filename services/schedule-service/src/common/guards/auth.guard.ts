import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import { AuthClientService } from '../../auth-client/auth-client.service.js';
import type { AuthenticatedUser } from '../../auth-client/auth-client.types.js';
import { DomainError } from '../errors/domain.error.js';

interface ScheduleGraphqlContext {
  req?: { headers?: Record<string, string | string[] | undefined> };
  user?: AuthenticatedUser;
}

export function extractBearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) {
    return null;
  }

  const [scheme, token, ...rest] = value.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }

  return token;
}

/**
 * Global guard: every GraphQL operation requires a bearer token that the Auth
 * Service accepts. REST health endpoints are not part of the protected surface.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authClient: AuthClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<'graphql' | 'http'>() !== 'graphql') {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo<GraphQLResolveInfo>();

    // Schema introspection stays public so GraphiQL can render the documented
    // schema. Data operations are always protected.
    if (info.fieldName === '__schema' || info.fieldName === '__type') {
      return true;
    }

    const ctx = gqlContext.getContext<ScheduleGraphqlContext>();
    const token = extractBearerToken(ctx.req?.headers?.authorization);

    if (!token) {
      throw new DomainError('UNAUTHORIZED', 'Missing or malformed bearer token', 401);
    }

    ctx.user = await this.authClient.validateToken(token);
    return true;
  }
}
