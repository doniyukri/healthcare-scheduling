import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@InputType({ description: 'Filters for the customer list.' })
export class CustomerFilterInput {
  @Field({
    nullable: true,
    description: 'Case-insensitive match against name or email.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @Field({ nullable: true, description: 'Exact email match (case-insensitive).' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @MaxLength(320)
  email?: string;
}
