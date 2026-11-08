import { Test } from '@nestjs/testing';
import { HealthResolver } from './health.resolver.js';

describe('HealthResolver', () => {
  it('resolves through the Nest dependency injection container', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [HealthResolver],
    }).compile();

    expect(moduleRef.get(HealthResolver).ping()).toBe('pong');
  });
});
