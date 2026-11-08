import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import type { Doctor } from '../../generated/prisma/client.js';

@ObjectType({ description: 'A doctor available for consultations.' })
export class DoctorEntity {
  @Field(() => ID, { description: 'Doctor identifier (UUID v4).' })
  id!: string;

  @Field({ description: 'Full name.' })
  name!: string;

  @Field(() => GraphQLISODateTime, { description: 'Creation time (UTC).' })
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { description: 'Last update time (UTC).' })
  updatedAt!: Date;
}

export function toDoctorEntity(doctor: Doctor): DoctorEntity {
  return {
    id: doctor.id,
    name: doctor.name,
    createdAt: doctor.createdAt,
    updatedAt: doctor.updatedAt,
  };
}
