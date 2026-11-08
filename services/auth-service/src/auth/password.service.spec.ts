import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import { DomainError } from '../common/errors/domain.error.js';
import { PasswordService } from './password.service.js';

function createService(rounds = 4): PasswordService {
  const config = {
    getOrThrow: jest.fn().mockReturnValue(rounds),
  } as unknown as ConfigService;

  return new PasswordService(config);
}

describe('PasswordService', () => {
  it('hashes a password and verifies it', async () => {
    const service = createService();
    const hash = await service.hash('Password123');

    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toBe('Password123');
    await expect(service.compare('Password123', hash)).resolves.toBe(true);
    await expect(service.compare('WrongPassword1', hash)).resolves.toBe(false);
  });

  it('rejects a password longer than 72 bytes', async () => {
    const service = createService();

    await expect(service.hash('a'.repeat(73))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('counts UTF-8 bytes, not characters', async () => {
    const service = createService();
    // 25 three-byte characters = 75 bytes.
    await expect(service.hash('€'.repeat(25))).rejects.toBeInstanceOf(DomainError);
  });

  it('runs a real comparison for unknown accounts without throwing', async () => {
    const service = createService();
    await expect(service.compareAgainstDummy('anything')).resolves.toBeUndefined();
  });
});
