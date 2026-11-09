import { DomainError } from './domain.error.js';
import { mapPrismaError, prismaErrorCode } from './prisma-error.js';

describe('prismaErrorCode', () => {
  it('extracts a Prisma error code', () => {
    expect(prismaErrorCode({ code: 'P2002' })).toBe('P2002');
  });

  it('returns null for non-objects and missing codes', () => {
    expect(prismaErrorCode(null)).toBeNull();
    expect(prismaErrorCode('P2002')).toBeNull();
    expect(prismaErrorCode({})).toBeNull();
  });
});

describe('mapPrismaError', () => {
  it('maps a known code to the provided domain error', () => {
    const error = Object.assign(new Error('unique'), { code: 'P2002' });

    expect(() =>
      mapPrismaError(error, {
        P2002: () => new DomainError('CUSTOMER_ALREADY_EXISTS', 'duplicate', 409),
      }),
    ).toThrow(
      expect.objectContaining({ code: 'CUSTOMER_ALREADY_EXISTS', statusCode: 409 }),
    );
  });

  it('rethrows an unmapped Prisma code', () => {
    const error = Object.assign(new Error('foreign key'), { code: 'P2003' });

    expect(() => mapPrismaError(error, {})).toThrow(error);
  });

  it('rethrows a non-Prisma error', () => {
    const error = new Error('connection lost');

    expect(() => mapPrismaError(error, { P2002: () => new DomainError('VALIDATION_ERROR', 'x') }))
      .toThrow(error);
  });
});
