import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { DomainError } from '../common/errors/domain.error.js';

const BCRYPT_MAX_BYTES = 72;

/**
 * A real bcrypt hash used to equalize login timing when the account does not
 * exist. It is not a credential for any account.
 */
const DUMMY_HASH = '$2b$12$yE9H0A.3TQ0HToHJhSDaie2LGQHKJu38kdhrA62JDTq5Jco8ymxMK';

@Injectable()
export class PasswordService {
  private readonly rounds: number;

  constructor(config: ConfigService) {
    this.rounds = config.getOrThrow<number>('BCRYPT_ROUNDS');
  }

  async hash(password: string): Promise<string> {
    this.assertWithinBcryptLimit(password);
    return bcrypt.hash(password, this.rounds);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Runs a real comparison for unknown accounts so response time does not
   * reveal whether an email is registered.
   */
  async compareAgainstDummy(password: string): Promise<void> {
    await bcrypt.compare(password, DUMMY_HASH);
  }

  private assertWithinBcryptLimit(password: string): void {
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
      throw new DomainError('VALIDATION_ERROR', 'password must not exceed 72 bytes', 400);
    }
  }
}
