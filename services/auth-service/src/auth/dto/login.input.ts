import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Payload for authenticating an existing user.' })
export class LoginInput {
  @Field({ description: 'Account email. Trimmed and lowercased before lookup.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(320, { message: 'email must not exceed 320 characters' })
  email!: string;

  @Field({ description: 'Account password.' })
  @IsString()
  @MinLength(1, { message: 'password must not be empty' })
  @MaxLength(72, { message: 'password must not exceed 72 bytes' })
  password!: string;
}
