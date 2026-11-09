import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { DoctorsModule } from '../doctors/doctors.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { SchedulesRepository } from './schedules.repository.js';
import { SchedulesResolver } from './schedules.resolver.js';
import { SchedulesService } from './schedules.service.js';

@Module({
  imports: [CustomersModule, DoctorsModule, QueueModule],
  providers: [SchedulesRepository, SchedulesService, SchedulesResolver],
})
export class SchedulesModule {}
