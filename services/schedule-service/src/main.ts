import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { GqlValidationPipe } from './common/validation/gql-validation.pipe.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  // GraphiQL loads inline assets, so CSP is disabled locally. The API itself
  // still gets the remaining Helmet protections.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.useGlobalPipes(new GqlValidationPipe());
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');
  const port = config.getOrThrow<number>('SCHEDULE_PORT');

  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((value) => value.trim()),
    credentials: true,
  });

  await app.listen(port, '0.0.0.0');
  app
    .get(Logger)
    .log(`schedule-service listening on :${port} (${config.getOrThrow<string>('NODE_ENV')})`);
}

void bootstrap();
