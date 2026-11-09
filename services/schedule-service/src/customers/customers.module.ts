import { Module } from '@nestjs/common';
import { CustomersRepository } from './customers.repository.js';
import { CustomersResolver } from './customers.resolver.js';
import { CustomersService } from './customers.service.js';

@Module({
  providers: [CustomersRepository, CustomersService, CustomersResolver],
  exports: [CustomersRepository],
})
export class CustomersModule {}
