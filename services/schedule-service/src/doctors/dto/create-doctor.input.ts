import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Payload for creating a doctor.' })
export class CreateDoctorInput {
  @Field({ description: 'Full name (1-200 characters).' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(200, { message: 'name must not exceed 200 characters' })
  name!: string;
}
