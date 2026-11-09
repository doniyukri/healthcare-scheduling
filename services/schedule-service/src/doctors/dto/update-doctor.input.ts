import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Payload for updating a doctor.' })
export class UpdateDoctorInput {
  @Field({ nullable: true, description: 'New full name.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(200, { message: 'name must not exceed 200 characters' })
  name?: string;
}
