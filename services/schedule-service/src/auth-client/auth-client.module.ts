import { Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service.js';

@Module({
  providers: [AuthClientService],
  exports: [AuthClientService],
})
export class AuthClientModule {}
