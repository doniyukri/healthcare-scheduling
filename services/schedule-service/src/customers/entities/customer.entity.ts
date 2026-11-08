import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import type { Customer } from '../../generated/prisma/client.js';

@ObjectType({ description: 'A patient (customer) who books consultations.' })
export class CustomerEntity {
  @Field(() => ID, { description: 'Customer identifier (UUID v4).' })
  id!: string;

  @Field({ description: 'Full name.' })
  name!: string;

  @Field({ description: 'Unique, normalized email address used for notifications.' })
  email!: string;

  @Field(() => GraphQLISODateTime, { description: 'Creation time (UTC).' })
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { description: 'Last update time (UTC).' })
  updatedAt!: Date;
}

export function toCustomerEntity(customer: Customer): CustomerEntity {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}
