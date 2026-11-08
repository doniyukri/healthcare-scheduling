import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Payload for creating a customer.' })
export class CreateCustomerInput {
  @Field({ description: 'Full name (1-200 characters).' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(200, { message: 'name must not exceed 200 characters' })
  name!: string;

  @Field({ description: 'Unique email address. Trimmed and lowercased before storage.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(320, { message: 'email must not exceed 320 characters' })
  email!: string;
}
