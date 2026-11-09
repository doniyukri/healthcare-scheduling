import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

@InputType({ description: '1-based pagination parameters.' })
export class PaginationInput {
  @Field(() => Int, {
    defaultValue: DEFAULT_PAGE,
    description: 'Page number, starting at 1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @Field(() => Int, {
    defaultValue: DEFAULT_LIMIT,
    description: `Items per page (1-${MAX_LIMIT}).`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}

@ObjectType({ description: 'Pagination metadata for a connection.' })
export class PageInfo {
  @Field(() => Int, { description: 'Current page (1-based).' })
  page!: number;

  @Field(() => Int, { description: 'Maximum items per page.' })
  limit!: number;

  @Field(() => Int, { description: 'Total number of matching items.' })
  total!: number;

  @Field(() => Int, { description: 'Total number of pages.' })
  totalPages!: number;

  @Field({ description: 'Whether a next page exists.' })
  hasNextPage!: boolean;

  @Field({ description: 'Whether a previous page exists.' })
  hasPreviousPage!: boolean;
}

export function buildPageInfo(page: number, limit: number, total: number): PageInfo {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

export function toSkipTake(pagination: PaginationInput): { skip: number; take: number } {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  };
}
