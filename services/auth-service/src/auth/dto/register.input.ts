import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: 'Payload for creating a user account.' })
export class RegisterInput {
  @Field({ description: 'Account email. Trimmed and lowercased before storage.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(320, { message: 'email must not exceed 320 characters' })
  email!: string;

  @Field({ description: 'Password. Minimum 8 characters, maximum 72 bytes.' })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72, { message: 'password must not exceed 72 bytes' })
  password!: string;
}
