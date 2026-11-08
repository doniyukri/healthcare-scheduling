import { Module } from '@nestjs/common';
import { DoctorsRepository } from './doctors.repository.js';
import { DoctorsResolver } from './doctors.resolver.js';
import { DoctorsService } from './doctors.service.js';

@Module({
  providers: [DoctorsRepository, DoctorsService, DoctorsResolver],
  exports: [DoctorsRepository],
})
export class DoctorsModule {}
