import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { RATE_LIMITS } from './common/constants.js';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard.js';
import { graphqlErrorPlugin } from './common/plugins/graphql-error.plugin.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

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
            paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
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

    ThrottlerModule.forRoot([{ name: 'default', ...RATE_LIMITS.global }]),

    PrismaModule,
    AuthModule,
    HealthModule,

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Written next to the compiled output: dist/ exists at runtime and is
      // owned by the non-root user, unlike src/ in the production image.
      autoSchemaFile: join(process.cwd(), 'dist/schema.gql'),
      sortSchema: true,
      autoTransformHttpErrors: false,
      preserveHttpStatusForExecutionErrors: false,
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req, res }: { req: Request & { id?: string }; res: Response }) => ({
        req,
        res,
        requestId: req.id,
      }),
      plugins: [graphqlErrorPlugin()],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
