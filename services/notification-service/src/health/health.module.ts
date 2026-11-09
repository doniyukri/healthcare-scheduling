import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [MailModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
