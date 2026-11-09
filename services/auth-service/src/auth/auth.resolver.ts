import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { RATE_LIMITS } from '../common/constants.js';
import { DomainError } from '../common/errors/domain.error.js';
import { UserEntity } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { AuthPayload } from './dto/auth-payload.js';
import { LoginInput } from './dto/login.input.js';
import { RegisterInput } from './dto/register.input.js';

@Resolver(() => UserEntity)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload, {
    description:
      'Create a user account. Passwords are hashed with bcrypt; emails are normalized and unique.',
  })
  @Throttle({ default: RATE_LIMITS.auth })
  register(
    @Args('input', { type: () => RegisterInput, description: 'Email and password for the new account.' }) input: RegisterInput,
  ): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Mutation(() => AuthPayload, {
    description: 'Authenticate a user and return a signed JWT access token.',
  })
  @Throttle({ default: RATE_LIMITS.auth })
  login(@Args('input', { type: () => LoginInput, description: 'Account credentials.' }) input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input);
  }

  @Query(() => UserEntity, {
    description:
      'Validate a JWT and return the corresponding user. Used by other services for authentication.',
  })
  validateToken(
    @Context() context: { req: { headers: { authorization?: string } } },
  ): Promise<UserEntity> {
    const match = /^Bearer\s+(\S+)$/i.exec(context.req.headers.authorization?.trim() ?? '');
    if (!match) throw new DomainError('UNAUTHORIZED', 'Missing or malformed bearer token', 401);
    const token = match[1];
    return this.authService.validateToken(token);
  }
}
