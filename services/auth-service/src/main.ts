import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { GqlValidationPipe } from './common/validation/gql-validation.pipe.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new GqlValidationPipe());
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');

  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((value) => value.trim()),
    credentials: true,
  });

  await app.listen(config.getOrThrow<number>('AUTH_PORT'), '0.0.0.0');
}

void bootstrap();
