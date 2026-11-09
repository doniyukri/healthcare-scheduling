import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsDate, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Payload for creating a schedule.' })
export class CreateScheduleInput {
  @Field({ description: 'Reason for the consultation (1-500 characters).' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'objective must not be empty' })
  @MaxLength(500, { message: 'objective must not exceed 500 characters' })
  objective!: string;

  @Field(() => ID, { description: 'Identifier of an existing customer.' })
  @IsUUID(undefined, { message: 'customerId must be a UUID' })
  customerId!: string;

  @Field(() => ID, { description: 'Identifier of an existing doctor.' })
  @IsUUID(undefined, { message: 'doctorId must be a UUID' })
  doctorId!: string;

  @Field(() => GraphQLISODateTime, {
    description: 'Consultation time. Stored in UTC; send an ISO-8601 timestamp.',
  })
  @IsDate({ message: 'scheduledAt must be a valid ISO-8601 date' })
  scheduledAt!: Date;
}
