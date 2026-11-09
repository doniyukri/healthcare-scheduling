import type { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    const mockConfig = {
      getOrThrow: (key: string) => {
        if (key === 'METRICS_ENABLED') return true;
        return undefined;
      },
    } as unknown as ConfigService;

    service = new MetricsService(mockConfig);
  });

  it('records processed jobs and email counts', async () => {
    service.recordJobProcessed('schedule.created', 'success');
    service.recordJobProcessed('schedule.created', 'failure');
    service.recordEmailSent('schedule.created');

    const endTimer = service.startJobTimer('schedule.created');
    endTimer();

    const output = await service.metrics();
    expect(output).toContain('notification_jobs_processed_total');
    expect(output).toContain('notification_emails_sent_total');
    expect(output).toContain('notification_job_duration_seconds');
  });

  it('provides contentType', () => {
    expect(service.contentType).toBeDefined();
  });
});
