import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service.js';

function createService(): TokenService {
  const jwt = new JwtService({
    secret: 'a'.repeat(32),
    signOptions: {
      expiresIn: '1h',
      issuer: 'healthcare-auth',
      audience: 'healthcare-api',
      algorithm: 'HS256',
    },
    verifyOptions: {
      issuer: 'healthcare-auth',
      audience: 'healthcare-api',
      algorithms: ['HS256'],
    },
  });

  return new TokenService(jwt);
}

describe('TokenService', () => {
  it('signs and verifies a token with subject, email, issuer and audience', async () => {
    const service = createService();
    const token = await service.sign('user-1', 'user@example.com');
    const payload = await service.verify(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('user@example.com');
    expect(payload.iss).toBe('healthcare-auth');
    expect(payload.aud).toBe('healthcare-api');
    expect(payload.exp).toBeGreaterThan(payload.iat ?? 0);
  });

  it('rejects a malformed token', async () => {
    const service = createService();

    await expect(service.verify('not.a.jwt')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('rejects a token signed with another secret', async () => {
    const other = new JwtService({
      secret: 'b'.repeat(32),
      signOptions: { issuer: 'healthcare-auth', audience: 'healthcare-api' },
    });
    const foreignToken = await other.signAsync(
      { email: 'user@example.com' },
      { subject: 'user-1' },
    );

    await expect(createService().verify(foreignToken)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a token with the wrong audience', async () => {
    const other = new JwtService({
      secret: 'a'.repeat(32),
      signOptions: { issuer: 'healthcare-auth', audience: 'another-api' },
    });
    const foreignToken = await other.signAsync(
      { email: 'user@example.com' },
      { subject: 'user-1' },
    );

    await expect(createService().verify(foreignToken)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
