import { Field, ObjectType } from '@nestjs/graphql';
import { PageInfo } from '../../common/pagination/pagination.js';
import { CustomerEntity } from '../../customers/entities/customer.entity.js';

@ObjectType({ description: 'A paginated page of customers.' })
export class CustomerConnection {
  @Field(() => [CustomerEntity], { description: 'Customers on this page.' })
  items!: CustomerEntity[];

  @Field(() => PageInfo, { description: 'Pagination metadata.' })
  pageInfo!: PageInfo;
}
