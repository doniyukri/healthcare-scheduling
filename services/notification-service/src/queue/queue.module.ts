import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { NotificationConsumer } from './notification.consumer.js';

@Module({
  imports: [MailModule],
  providers: [NotificationConsumer],
  exports: [NotificationConsumer],
})
export class QueueModule {}
