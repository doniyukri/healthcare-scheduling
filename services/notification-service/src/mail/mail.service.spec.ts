import { jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';
import type { MetricsService } from '../metrics/metrics.service.js';
import { MailService } from './mail.service.js';

describe('MailService', () => {
  let service: MailService;
  let sendMailMock: jest.Mock;
  let verifyMock: jest.Mock;
  let recordEmailSentMock: jest.Mock;

  const samplePayload = {
    event: 'schedule.created' as const,
    scheduleId: 'test-sched-123',
    customer: {
      id: 'cust-1',
      name: 'Alice Smith',
      email: 'alice@example.com',
    },
    doctor: {
      id: 'doc-1',
      name: 'John Doe',
    },
    objective: 'Routine Checkup',
    scheduledAt: '2026-12-01T10:00:00.000Z',
  };

  beforeEach(async () => {
    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'msg-1' } as never);
    verifyMock = jest.fn().mockResolvedValue(true as never);
    recordEmailSentMock = jest.fn();

    const mockConfig = {
      get: jest.fn((key: string) => {
        if (key === 'TEMPLATES_DIR') return 'templates';
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          SMTP_HOST: 'localhost',
          SMTP_PORT: 1025,
          SMTP_SECURE: false,
          MAIL_TIMEZONE: 'Asia/Jakarta',
          MAIL_FROM: 'no-reply@clinic.local',
          MAIL_FROM_NAME: 'Clinic Care',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    const mockMetrics = {
      recordEmailSent: recordEmailSentMock,
    } as unknown as MetricsService;

    service = new MailService(mockConfig, mockMetrics);
    await service.onModuleInit();

    // Inject mocked transporter
    (service as unknown as { transporter: unknown }).transporter = {
      sendMail: sendMailMock,
      verify: verifyMock,
    };
  });

  it('sends schedule.created email with correct subject and recipient', async () => {
    await service.sendScheduleNotification(samplePayload);

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailArgs = sendMailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
      from: string;
    };
    expect(mailArgs.to).toBe('alice@example.com');
    expect(mailArgs.subject).toContain('Dr. John Doe');
    expect(mailArgs.subject).toContain('Appointment Confirmation');
    expect(mailArgs.text).toContain('test-sched-123');
    expect(mailArgs.html).toContain('Alice Smith');
    expect(recordEmailSentMock).toHaveBeenCalledWith('schedule.created');
  });

  it('sends schedule.deleted email with correct subject', async () => {
    await service.sendScheduleNotification({
      ...samplePayload,
      event: 'schedule.deleted',
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailArgs = sendMailMock.mock.calls[0][0] as {
      to: string;
      subject: string;
    };
    expect(mailArgs.subject).toContain('Appointment Cancelled');
    expect(recordEmailSentMock).toHaveBeenCalledWith('schedule.deleted');
  });

  it('reports healthy when transporter.verify succeeds', async () => {
    await expect(service.isHealthy()).resolves.toBe(true);
  });

  it('reports unhealthy when transporter.verify fails', async () => {
    verifyMock.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(service.isHealthy()).resolves.toBe(false);
  });
});
