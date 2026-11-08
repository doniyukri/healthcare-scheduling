import { Field, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../common/pagination/pagination.js';
import { ScheduleEntity } from './schedule.entity.js';

@ObjectType({ description: 'A paginated page of schedules.' })
export class ScheduleConnection {
  @Field(() => [ScheduleEntity], { description: 'Schedules on this page.' })
  items!: ScheduleEntity[];

  @Field(() => PageInfo, { description: 'Pagination metadata.' })
  pageInfo!: PageInfo;
}
