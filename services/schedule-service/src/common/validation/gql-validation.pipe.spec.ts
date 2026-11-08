import 'reflect-metadata';
import type { ArgumentMetadata } from '@nestjs/common';
import { GqlValidationPipe } from './gql-validation.pipe.js';
import { CreateCustomerInput } from '../../customers/dto/create-customer.input.js';

const metadata: ArgumentMetadata = {
  type: 'body',
  metatype: CreateCustomerInput,
  data: undefined,
};

describe('GqlValidationPipe', () => {
  const pipe = new GqlValidationPipe();

  it('trims the name and normalizes the email', async () => {
    const result = (await pipe.transform(
      { name: '  Budi Santoso  ', email: '  BUDI@Example.COM ' },
      metadata,
    )) as CreateCustomerInput;

    expect(result.name).toBe('Budi Santoso');
    expect(result.email).toBe('budi@example.com');
  });

  it('rejects an invalid email with field details', async () => {
    await expect(
      pipe.transform({ name: 'Budi', email: 'not-an-email' }, metadata),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: { fields: { email: expect.any(Array) } },
    });
  });

  it('rejects an empty name', async () => {
    await expect(
      pipe.transform({ name: '   ', email: 'budi@example.com' }, metadata),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects unknown fields', async () => {
    await expect(
      pipe.transform({ name: 'Budi', email: 'budi@example.com', role: 'admin' }, metadata),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
