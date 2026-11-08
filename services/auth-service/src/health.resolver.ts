import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  @Query(() => String, { description: 'Liveness probe exposed through GraphQL.' })
  ping(): string {
    return 'pong';
  }
}
