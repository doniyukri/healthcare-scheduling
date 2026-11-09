import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Payload for updating a customer. At least one field is required.' })
export class UpdateCustomerInput {
  @Field({ nullable: true, description: 'New full name.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(200, { message: 'name must not exceed 200 characters' })
  name?: string;

  @Field({ nullable: true, description: 'New unique email address.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(320, { message: 'email must not exceed 320 characters' })
  email?: string;
}
