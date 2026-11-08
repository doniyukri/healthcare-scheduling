import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@InputType({ description: 'Filters for the doctor list.' })
export class DoctorFilterInput {
  @Field({ nullable: true, description: 'Case-insensitive match against the name.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}
