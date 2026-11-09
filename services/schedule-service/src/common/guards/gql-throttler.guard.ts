import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { DomainError } from '../errors/domain.error.js';

/**
 * Throttler guard scoped to GraphQL operations. Health endpoints are excluded
 * because container probes run every few seconds.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.getType<'graphql' | 'http'>() !== 'graphql';
  }

  protected getRequestResponse(context: ExecutionContext): {
    req: Record<string, unknown>;
    res: Record<string, unknown>;
  } {
    const ctx = GqlExecutionContext.create(context).getContext<{
      req?: Record<string, unknown>;
      res?: Record<string, unknown>;
    }>();

    if (ctx?.req) {
      return { req: ctx.req, res: ctx.res ?? {} };
    }

    const http = context.switchToHttp();
    return { req: http.getRequest(), res: http.getResponse() };
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new DomainError('RATE_LIMITED', 'Too many requests. Please try again later.', 429);
  }
}
