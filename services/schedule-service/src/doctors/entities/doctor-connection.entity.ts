import { Field, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../common/pagination/pagination.js';
import { DoctorEntity } from './doctor.entity.js';

@ObjectType({ description: 'A paginated page of doctors.' })
export class DoctorConnection {
  @Field(() => [DoctorEntity], { description: 'Doctors on this page.' })
  items!: DoctorEntity[];

  @Field(() => PageInfo, { description: 'Pagination metadata.' })
  pageInfo!: PageInfo;
}
