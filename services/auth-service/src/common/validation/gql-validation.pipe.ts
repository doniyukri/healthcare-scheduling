import { Injectable, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { DomainError } from '../errors/domain.error.js';

function flatten(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const error of errors) {
    const path = parent ? `${parent}.${error.property}` : error.property;

    if (error.constraints) {
      fields[path] = Object.values(error.constraints);
    }

    if (error.children?.length) {
      Object.assign(fields, flatten(error.children, path));
    }
  }

  return fields;
}

/**
 * Validation pipe tuned for GraphQL: unknown fields are rejected, values are
 * transformed (email normalization) and every failure becomes VALIDATION_ERROR.
 */
@Injectable()
export class GqlValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new DomainError('VALIDATION_ERROR', 'Input validation failed', 400, {
          fields: flatten(errors),
        }),
    });
  }
}
