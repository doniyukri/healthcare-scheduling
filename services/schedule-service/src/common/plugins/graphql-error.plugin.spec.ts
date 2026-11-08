import { graphqlErrorPlugin } from './graphql-error.plugin.js';

describe('graphqlErrorPlugin', () => {
  it('adds the request id and applies the declared HTTP status', async () => {
    const plugin = graphqlErrorPlugin();
    const listener = await plugin.requestDidStart!({} as never);

    const errors = [
      {
        message: 'conflict',
        extensions: { code: 'SCHEDULE_CONFLICT', http: { status: 409 } },
      },
    ];
    const response = {
      body: { kind: 'single' as const, singleResult: { data: null, errors } },
      http: { status: 200, headers: new Map() },
    };

    await listener!.willSendResponse!({
      response,
      contextValue: { requestId: 'req-1' },
    } as never);

    expect(errors[0].extensions).toMatchObject({ requestId: 'req-1' });
    expect(response.http.status).toBe(409);
  });

  it('ignores incremental responses', async () => {
    const plugin = graphqlErrorPlugin();
    const listener = await plugin.requestDidStart!({} as never);

    const response = {
      body: { kind: 'incremental' as const, initialResult: {} },
      http: { status: 200, headers: new Map() },
    };

    await expect(
      listener!.willSendResponse!({ response, contextValue: {} } as never),
    ).resolves.toBeUndefined();
    expect(response.http.status).toBe(200);
  });

  it('keeps the status when no HTTP status is declared', async () => {
    const plugin = graphqlErrorPlugin();
    const listener = await plugin.requestDidStart!({} as never);

    const errors = [{ message: 'boom', extensions: { code: 'INTERNAL_SERVER_ERROR' } }];
    const response = {
      body: { kind: 'single' as const, singleResult: { data: null, errors } },
      http: { status: 200, headers: new Map() },
    };

    await listener!.willSendResponse!({
      response,
      contextValue: { requestId: 'req-2' },
    } as never);

    expect(response.http.status).toBe(200);
    expect(errors[0].extensions).toMatchObject({ requestId: 'req-2' });
  });
});
