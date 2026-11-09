import { Field, ObjectType } from '@nestjs/graphql';
import { UserEntity } from '../../users/entities/user.entity.js';

@ObjectType({ description: 'Result of a successful register or login call.' })
export class AuthPayload {
  @Field({ description: 'Signed JWT access token (HS256).' })
  accessToken!: string;

  @Field(() => UserEntity, { description: 'The authenticated user.' })
  user!: UserEntity;
}
