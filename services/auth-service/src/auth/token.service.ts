import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainError } from '../common/errors/domain.error.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  sign(userId: string, email: string): Promise<string> {
    return this.jwt.signAsync({ email }, { subject: userId });
  }

  async verify(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);

      if (!payload.sub || !payload.email) {
        throw new Error('Malformed token payload');
      }

      return payload;
    } catch {
      throw new DomainError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }
  }
}
