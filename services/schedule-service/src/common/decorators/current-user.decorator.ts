import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthenticatedUser } from '../../auth-client/auth-client.types.js';

/**
 * Injects the user resolved by AuthGuard. Every protected resolver can depend
 * on the caller identity without repeating the HTTP lookup.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const ctx = GqlExecutionContext.create(context).getContext<{
      user?: AuthenticatedUser;
    }>();

    if (!ctx.user) {
      // AuthGuard always runs first; this is a programming error, not user input.
      throw new Error('CurrentUser used on a resolver without AuthGuard');
    }

    return ctx.user;
  },
);
