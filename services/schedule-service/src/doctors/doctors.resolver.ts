import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PaginationInput } from '../common/pagination/pagination.js';
import { DoctorsService } from './doctors.service.js';
import { CreateDoctorInput } from './dto/create-doctor.input.js';
import { DoctorFilterInput } from './dto/doctor-filter.input.js';
import { UpdateDoctorInput } from './dto/update-doctor.input.js';
import { DoctorConnection } from './entities/doctor-connection.entity.js';
import { DoctorEntity } from './entities/doctor.entity.js';

@Resolver(() => DoctorEntity)
export class DoctorsResolver {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Query(() => DoctorConnection, {
    description: 'List doctors with optional name search and 1-based pagination.',
  })
  doctors(
    @Args('filter', {
      type: () => DoctorFilterInput,
      nullable: true,
      description: 'Optional name search filter.',
    })
    filter?: DoctorFilterInput,
    @Args('pagination', {
      type: () => PaginationInput,
      nullable: true,
      description: 'Page and page size (defaults: page 1, limit 10).',
    })
    pagination?: PaginationInput,
  ): Promise<DoctorConnection> {
    return this.doctorsService.findMany(filter, pagination ?? new PaginationInput());
  }

  @Query(() => DoctorEntity, {
    nullable: true,
    description: 'Fetch a single doctor by ID. Raises DOCTOR_NOT_FOUND when it does not exist.',
  })
  doctor(
    @Args('id', { type: () => ID, description: 'Doctor identifier.' }) id: string,
  ): Promise<DoctorEntity> {
    return this.doctorsService.findOne(id);
  }

  @Mutation(() => DoctorEntity, { description: 'Create a doctor.' })
  createDoctor(
    @Args('input', { type: () => CreateDoctorInput, description: 'Doctor details.' })
    input: CreateDoctorInput,
  ): Promise<DoctorEntity> {
    return this.doctorsService.create(input);
  }

  @Mutation(() => DoctorEntity, { description: 'Update a doctor.' })
  updateDoctor(
    @Args('id', { type: () => ID, description: 'Doctor identifier.' }) id: string,
    @Args('input', { type: () => UpdateDoctorInput, description: 'Fields to update.' })
    input: UpdateDoctorInput,
  ): Promise<DoctorEntity> {
    return this.doctorsService.update(id, input);
  }

  @Mutation(() => DoctorEntity, {
    description: 'Delete a doctor. Rejected when the doctor still has schedules.',
  })
  deleteDoctor(
    @Args('id', { type: () => ID, description: 'Doctor identifier.' }) id: string,
  ): Promise<DoctorEntity> {
    return this.doctorsService.delete(id);
  }
}
