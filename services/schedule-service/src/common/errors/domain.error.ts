import { GraphQLError } from 'graphql';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'CUSTOMER_NOT_FOUND'
  | 'CUSTOMER_ALREADY_EXISTS'
  | 'CUSTOMER_HAS_SCHEDULES'
  | 'DOCTOR_NOT_FOUND'
  | 'DOCTOR_HAS_SCHEDULES'
  | 'SCHEDULE_NOT_FOUND'
  | 'SCHEDULE_CONFLICT'
  | 'AUTH_SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR';

/**
 * A domain error carrying a stable machine-readable code and an HTTP status.
 * GraphQL clients read `extensions.code`; the transport returns an honest
 * status code so HTTP tooling and proxies behave correctly.
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
