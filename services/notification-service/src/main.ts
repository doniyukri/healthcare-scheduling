import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('NOTIFICATION_PORT');

  await app.listen(port, '0.0.0.0');
  app
    .get(Logger)
    .log(`notification-service listening on :${port} (${config.getOrThrow<string>('NODE_ENV')})`);
}

void bootstrap();
