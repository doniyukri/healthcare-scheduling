import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.getOrThrow<string>('LOG_LEVEL'),
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id =
              typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          redact: {
            paths: ['req.headers.cookie'],
            censor: '[redacted]',
          },
          transport:
            config.get<string>('NODE_ENV') === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, colorize: true },
                }
              : undefined,
        },
      }),
    }),

    MetricsModule,
    MailModule,
    QueueModule,
    HealthModule,
  ],
})
export class AppModule {}
