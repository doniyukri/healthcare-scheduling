import { Module } from '@nestjs/common';
import { NotificationProducer } from './notification.producer.js';

@Module({
  providers: [NotificationProducer],
  exports: [NotificationProducer],
})
export class QueueModule {}
