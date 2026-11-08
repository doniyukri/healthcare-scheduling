import type { ApolloServerPlugin } from '@apollo/server';

export interface GraphqlContext {
  requestId?: string;
  req: unknown;
  res: unknown;
}

/**
 * Adds the correlation ID to every GraphQL error and applies the HTTP status
 * declared by the domain error (`extensions.http.status`).
 */
export function graphqlErrorPlugin(): ApolloServerPlugin<GraphqlContext> {
  return {
    async requestDidStart() {
      return {
        async willSendResponse({ response, contextValue }) {
          const body = response.body;

          if (body.kind !== 'single' || !body.singleResult.errors) {
            return;
          }

          for (const error of body.singleResult.errors) {
            const extensions: Record<string, unknown> = {
              ...error.extensions,
              ...(contextValue.requestId ? { requestId: contextValue.requestId } : {}),
            };

            (error as unknown as { extensions: Record<string, unknown> }).extensions =
              extensions;

            const http = extensions.http as { status?: number } | undefined;

            if (typeof http?.status === 'number' && response.http) {
              response.http.status = http.status;
            }
          }
        },
      };
    },
  };
}
