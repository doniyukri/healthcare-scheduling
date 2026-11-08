import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import type { Customer, Doctor, Schedule } from '../../generated/prisma/client.js';
import { CustomerEntity, toCustomerEntity } from '../../customers/entities/customer.entity.js';
import { DoctorEntity, toDoctorEntity } from '../../doctors/entities/doctor.entity.js';

@ObjectType({ description: 'A consultation booking between a customer and a doctor.' })
export class ScheduleEntity {
  @Field(() => ID, { description: 'Schedule identifier (UUID v4).' })
  id!: string;

  @Field({ description: 'Reason for the consultation.' })
  objective!: string;

  @Field(() => ID, { description: 'Identifier of the customer.' })
  customerId!: string;

  @Field(() => ID, { description: 'Identifier of the doctor.' })
  doctorId!: string;

  @Field(() => GraphQLISODateTime, {
    description: 'Consultation time in UTC, returned as ISO-8601.',
  })
  scheduledAt!: Date;

  @Field(() => CustomerEntity, { description: 'The customer, loaded in the same query.' })
  customer!: CustomerEntity;

  @Field(() => DoctorEntity, { description: 'The doctor, loaded in the same query.' })
  doctor!: DoctorEntity;

  @Field(() => GraphQLISODateTime, { description: 'Creation time (UTC).' })
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { description: 'Last update time (UTC).' })
  updatedAt!: Date;
}

export type ScheduleWithRelations = Schedule & {
  customer: Customer;
  doctor: Doctor;
};

export function toScheduleEntity(schedule: ScheduleWithRelations): ScheduleEntity {
  return {
    id: schedule.id,
    objective: schedule.objective,
    customerId: schedule.customerId,
    doctorId: schedule.doctorId,
    scheduledAt: schedule.scheduledAt,
    customer: toCustomerEntity(schedule.customer),
    doctor: toDoctorEntity(schedule.doctor),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}
