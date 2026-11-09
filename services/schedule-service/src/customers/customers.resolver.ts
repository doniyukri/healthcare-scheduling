import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  PaginationInput,
} from '../common/pagination/pagination.js';
import { CustomersService } from './customers.service.js';
import { CustomerFilterInput } from './dto/customer-filter.input.js';
import { CreateCustomerInput } from './dto/create-customer.input.js';
import { UpdateCustomerInput } from './dto/update-customer.input.js';
import { CustomerConnection } from './entities/customer-connection.entity.js';
import { CustomerEntity } from './entities/customer.entity.js';

@Resolver(() => CustomerEntity)
export class CustomersResolver {
  constructor(private readonly customersService: CustomersService) {}

  @Query(() => CustomerConnection, {
    description: 'List customers with optional filters and 1-based pagination.',
  })
  customers(
    @Args('filter', {
      type: () => CustomerFilterInput,
      nullable: true,
      description: 'Optional search and email filters.',
    })
    filter?: CustomerFilterInput,
    @Args('pagination', {
      type: () => PaginationInput,
      nullable: true,
      description: 'Page and page size (defaults: page 1, limit 10).',
    })
    pagination?: PaginationInput,
  ): Promise<CustomerConnection> {
    return this.customersService.findMany(filter, pagination ?? new PaginationInput());
  }

  @Query(() => CustomerEntity, {
    nullable: true,
    description: 'Fetch a single customer by ID. Raises CUSTOMER_NOT_FOUND when it does not exist.',
  })
  customer(
    @Args('id', { type: () => ID, description: 'Customer identifier.' }) id: string,
  ): Promise<CustomerEntity> {
    return this.customersService.findOne(id);
  }

  @Mutation(() => CustomerEntity, { description: 'Create a customer.' })
  createCustomer(
    @Args('input', { type: () => CreateCustomerInput, description: 'Customer details.' })
    input: CreateCustomerInput,
  ): Promise<CustomerEntity> {
    return this.customersService.create(input);
  }

  @Mutation(() => CustomerEntity, { description: 'Update a customer. At least one field is required.' })
  updateCustomer(
    @Args('id', { type: () => ID, description: 'Customer identifier.' }) id: string,
    @Args('input', { type: () => UpdateCustomerInput, description: 'Fields to update.' })
    input: UpdateCustomerInput,
  ): Promise<CustomerEntity> {
    return this.customersService.update(id, input);
  }

  @Mutation(() => CustomerEntity, {
    description: 'Delete a customer. Rejected when the customer still has schedules.',
  })
  deleteCustomer(
    @Args('id', { type: () => ID, description: 'Customer identifier.' }) id: string,
  ): Promise<CustomerEntity> {
    return this.customersService.delete(id);
  }
}
