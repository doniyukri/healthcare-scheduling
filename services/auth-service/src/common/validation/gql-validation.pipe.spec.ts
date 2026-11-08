import 'reflect-metadata';
import type { ArgumentMetadata } from '@nestjs/common';
import { GqlValidationPipe } from './gql-validation.pipe.js';
import { RegisterInput } from '../../auth/dto/register.input.js';

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: RegisterInput,
  data: undefined,
};

describe('GqlValidationPipe', () => {
  const pipe = new GqlValidationPipe();

  it('normalizes the email and returns the transformed input', async () => {
    const result = (await pipe.transform(
      { email: '  USER@Example.COM ', password: 'Password123' },
      metadata,
    )) as RegisterInput;

    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe('Password123');
  });

  it('rejects an invalid email with VALIDATION_ERROR details', async () => {
    await expect(
      pipe.transform({ email: 'not-an-email', password: 'Password123' }, metadata),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: { fields: { email: expect.any(Array) } },
    });
  });

  it('rejects a short password', async () => {
    await expect(
      pipe.transform({ email: 'user@example.com', password: 'short' }, metadata),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects unknown fields', async () => {
    await expect(
      pipe.transform({ email: 'user@example.com', password: 'Password123', admin: true }, metadata),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
