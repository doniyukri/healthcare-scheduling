import { GraphQLError } from 'graphql';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INTERNAL_SERVER_ERROR';

/**
 * A domain error that carries a stable machine-readable code and an HTTP status.
 * GraphQL clients get `extensions.code`; the HTTP layer gets an honest status.
 */
export class DomainError extends GraphQLError {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly statusCode: number = 400,
    readonly details?: unknown,
  ) {
    super(message, {
      extensions: {
        code,
        http: { status: statusCode },
        ...(details === undefined ? {} : { details }),
      },
    });
    this.name = 'DomainError';
  }
}
