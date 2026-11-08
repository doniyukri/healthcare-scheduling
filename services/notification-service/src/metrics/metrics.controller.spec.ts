import { jest } from '@jest/globals';
import type { Response } from 'express';
import { MetricsController } from './metrics.controller.js';
import type { MetricsService } from './metrics.service.js';

describe('MetricsController', () => {
  it('sets header and sends prometheus metrics', async () => {
    const mockMetricsService = {
      contentType: 'text/plain; version=0.0.4',
      metrics: jest.fn().mockResolvedValue('# HELP test' as never),
    } as unknown as MetricsService;

    const controller = new MetricsController(mockMetricsService);
    const setHeaderMock = jest.fn();
    const sendMock = jest.fn();

    const res = {
      setHeader: setHeaderMock,
      send: sendMock,
    } as unknown as Response;

    await controller.getMetrics(res);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4');
    expect(sendMock).toHaveBeenCalledWith('# HELP test');
  });
});
