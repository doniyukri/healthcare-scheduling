import type { DomainError } from '../errors/domain.error.js';

interface PrismaLikeError {
  code?: unknown;
  meta?: unknown;
}

export function prismaErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const code = (error as PrismaLikeError).code;
  return typeof code === 'string' ? code : null;
}

/**
 * Maps Prisma's known failure modes to domain errors. Anything unknown is
 * rethrown so it surfaces as a genuine 500 instead of a misleading 4xx.
 */
export function mapPrismaError(
  error: unknown,
  mapping: Partial<
    Record<'P2002' | 'P2003' | 'P2025', () => DomainError>
  >,
): never {
  const code = prismaErrorCode(error);
  const factory = code ? mapping[code as keyof typeof mapping] : undefined;

  if (factory) {
    throw factory();
  }

  throw error;
}
