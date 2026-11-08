import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthenticatedUser } from '../auth-client/auth-client.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationInput } from '../common/pagination/pagination.js';
import { CreateScheduleInput } from './dto/create-schedule.input.js';
import { ScheduleFilterInput } from './dto/schedule-filter.input.js';
import { ScheduleConnection } from './entities/schedule-connection.entity.js';
import { ScheduleEntity } from './entities/schedule.entity.js';
import { SchedulesService } from './schedules.service.js';

@Resolver(() => ScheduleEntity)
export class SchedulesResolver {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Query(() => ScheduleConnection, {
    description:
      'List schedules with doctor, customer, date-range and objective filters plus 1-based pagination.',
  })
  schedules(
    @Args('filter', {
      type: () => ScheduleFilterInput,
      nullable: true,
      description: 'Optional doctor, customer, date-range and text filters.',
    })
    filter?: ScheduleFilterInput,
    @Args('pagination', {
      type: () => PaginationInput,
      nullable: true,
      description: 'Page and page size (defaults: page 1, limit 10).',
    })
    pagination?: PaginationInput,
  ): Promise<ScheduleConnection> {
    return this.schedulesService.findMany(filter, pagination ?? new PaginationInput());
  }

  @Query(() => ScheduleEntity, {
    nullable: true,
    description:
      'Fetch a single schedule by ID, including its customer and doctor. Raises SCHEDULE_NOT_FOUND when missing.',
  })
  schedule(
    @Args('id', { type: () => ID, description: 'Schedule identifier.' }) id: string,
  ): Promise<ScheduleEntity> {
    return this.schedulesService.findOne(id);
  }

  @Mutation(() => ScheduleEntity, {
    description:
      'Create a schedule. Rejects unknown customers/doctors and doctor double-booking, then queues a confirmation email.',
  })
  createSchedule(
    @Args('input', { type: () => CreateScheduleInput, description: 'Schedule details.' })
    input: CreateScheduleInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ScheduleEntity> {
    return this.schedulesService.create(input, user);
  }

  @Mutation(() => ScheduleEntity, {
    description:
      'Delete a schedule. Queues a cancellation email and writes an audit entry.',
  })
  deleteSchedule(
    @Args('id', { type: () => ID, description: 'Schedule identifier.' }) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ScheduleEntity> {
    return this.schedulesService.delete(id, user);
  }
}
