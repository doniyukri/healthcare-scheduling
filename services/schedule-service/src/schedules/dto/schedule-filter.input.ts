import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsDate, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

@InputType({ description: 'Filters for the schedule list.' })
export class ScheduleFilterInput {
  @Field(() => ID, { nullable: true, description: 'Only schedules for this doctor.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'doctorId must be a UUID' })
  doctorId?: string;

  @Field(() => ID, { nullable: true, description: 'Only schedules for this customer.' })
  @IsOptional()
  @IsUUID(undefined, { message: 'customerId must be a UUID' })
  customerId?: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Inclusive lower bound for scheduledAt.',
  })
  @IsOptional()
  @IsDate({ message: 'from must be a valid ISO-8601 date' })
  from?: Date;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Inclusive upper bound for scheduledAt.',
  })
  @IsOptional()
  @IsDate({ message: 'to must be a valid ISO-8601 date' })
  to?: Date;

  @Field({ nullable: true, description: 'Case-insensitive match against the objective.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}
