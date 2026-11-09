import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import type { User } from '../../generated/prisma/client.js';

@ObjectType({ description: 'An authenticated user account.' })
export class UserEntity {
  @Field(() => ID, { description: 'User identifier (UUID v4).' })
  id!: string;

  @Field({ description: 'Normalized, unique email address.' })
  email!: string;

  @Field(() => GraphQLISODateTime, { description: 'Creation time (UTC).' })
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { description: 'Last update time (UTC).' })
  updatedAt!: Date;
}

export function toUserEntity(user: User): UserEntity {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
