import { Injectable } from '@nestjs/common';
import { DomainError } from '../common/errors/domain.error.js';
import { toUserEntity, type UserEntity } from '../users/entities/user.entity.js';
import { UsersRepository } from '../users/users.repository.js';
import type { AuthPayload } from './dto/auth-payload.js';
import type { LoginInput } from './dto/login.input.js';
import type { RegisterInput } from './dto/register.input.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthPayload> {
    const existing = await this.users.findByEmail(input.email);

    if (existing) {
      throw new DomainError(
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists',
        409,
      );
    }

    const password = await this.passwords.hash(input.password);
    const user = await this.users.create({ email: input.email, password });
    const accessToken = await this.tokens.sign(user.id, user.email);

    return { accessToken, user: toUserEntity(user) };
  }

  async login(input: LoginInput): Promise<AuthPayload> {
    const user = await this.users.findByEmail(input.email);

    if (!user) {
      await this.passwords.compareAgainstDummy(input.password);
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const matches = await this.passwords.compare(input.password, user.password);

    if (!matches) {
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const accessToken = await this.tokens.sign(user.id, user.email);

    return { accessToken, user: toUserEntity(user) };
  }

  async validateToken(token: string): Promise<UserEntity> {
    const payload = await this.tokens.verify(token);
    const user = await this.users.findById(payload.sub);

    if (!user) {
      throw new DomainError('UNAUTHORIZED', 'User no longer exists', 401);
    }

    return toUserEntity(user);
  }
}
