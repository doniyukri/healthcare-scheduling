import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import depthLimit from 'graphql-depth-limit';
import { LoggerModule } from 'nestjs-pino';
import { AuthClientModule } from './auth-client/auth-client.module.js';
import { CacheModule } from './cache/cache.module.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard.js';
import { graphqlErrorPlugin } from './common/plugins/graphql-error.plugin.js';
import { validateEnv } from './config/env.validation.js';
import { CustomersModule } from './customers/customers.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { SchedulesModule } from './schedules/schedules.module.js';

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
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.variables.input.password',
              'req.body.variables.input.email',
            ],
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

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: config.getOrThrow<number>('SCHEDULE_THROTTLE_TTL_MS'),
          limit: config.getOrThrow<number>('SCHEDULE_THROTTLE_LIMIT'),
        },
      ],
    }),

    PrismaModule,
    MetricsModule,
    CacheModule,
    AuthClientModule,
    QueueModule,
    CustomersModule,
    DoctorsModule,
    SchedulesModule,
    HealthModule,

    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // dist/ exists at runtime and is writable by the non-root user.
        autoSchemaFile: join(process.cwd(), 'dist/schema.gql'),
        sortSchema: true,
        autoTransformHttpErrors: false,
        preserveHttpStatusForExecutionErrors: false,
        introspection: config.getOrThrow<boolean>('GRAPHQL_INTROSPECTION'),
        validationRules: [depthLimit(config.getOrThrow<number>('GRAPHQL_DEPTH_LIMIT'))],
        context: ({ req, res }: { req: Request & { id?: string }; res: Response }) => ({
          req,
          res,
          requestId: req.id,
        }),
        plugins: [graphqlErrorPlugin()],
      }),
    }),
  ],
  providers: [
    // Order matters: reject abusive traffic before doing an inter-service call.
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
