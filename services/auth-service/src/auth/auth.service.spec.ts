import { jest } from '@jest/globals';
import type { User } from '../generated/prisma/client.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AuthService } from './auth.service.js';
import type { PasswordService } from './password.service.js';
import type { TokenService } from './token.service.js';

const user: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  password: 'hashed-password',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService() {
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const passwords = {
    hash: jest.fn(),
    compare: jest.fn(),
    compareAgainstDummy: jest.fn(),
  };
  const tokens = {
    sign: jest.fn().mockResolvedValue('signed-token'),
    verify: jest.fn(),
  };

  const service = new AuthService(
    users as unknown as UsersRepository,
    passwords as unknown as PasswordService,
    tokens as unknown as TokenService,
  );

  return { service, users, passwords, tokens };
}

describe('AuthService', () => {
  describe('register', () => {
    it('creates the user and returns a token without exposing the password', async () => {
      const { service, users, passwords, tokens } = createService();
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('hashed-password');
      users.create.mockResolvedValue(user);

      const result = await service.register({
        email: 'user@example.com',
        password: 'Password123',
      });

      expect(passwords.hash).toHaveBeenCalledWith('Password123');
      expect(users.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'hashed-password',
      });
      expect(tokens.sign).toHaveBeenCalledWith(user.id, user.email);
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('rejects a duplicate email before hashing', async () => {
      const { service, users, passwords } = createService();
      users.findByEmail.mockResolvedValue(user);

      await expect(
        service.register({ email: 'user@example.com', password: 'Password123' }),
      ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', statusCode: 409 });

      expect(passwords.hash).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token when the password matches', async () => {
      const { service, users, passwords } = createService();
      users.findByEmail.mockResolvedValue(user);
      passwords.compare.mockResolvedValue(true);

      const result = await service.login({
        email: 'user@example.com',
        password: 'Password123',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.user.email).toBe(user.email);
    });

    it('runs a dummy comparison and rejects an unknown email', async () => {
      const { service, users, passwords } = createService();
      users.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'missing@example.com', password: 'Password123' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 });

      expect(passwords.compareAgainstDummy).toHaveBeenCalledWith('Password123');
    });

    it('rejects a wrong password', async () => {
      const { service, users, passwords } = createService();
      users.findByEmail.mockResolvedValue(user);
      passwords.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'WrongPassword1' }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('validateToken', () => {
    it('returns the user for a valid token', async () => {
      const { service, users, tokens } = createService();
      tokens.verify.mockResolvedValue({ sub: user.id, email: user.email });
      users.findById.mockResolvedValue(user);

      await expect(service.validateToken('signed-token')).resolves.toMatchObject({
        id: user.id,
        email: user.email,
      });
    });

    it('rejects a valid token whose user was deleted', async () => {
      const { service, users, tokens } = createService();
      tokens.verify.mockResolvedValue({ sub: user.id, email: user.email });
      users.findById.mockResolvedValue(null);

      await expect(service.validateToken('signed-token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    });
  });
});
