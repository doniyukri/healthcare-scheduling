import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import nodemailer, { type Transporter } from 'nodemailer';
import { MetricsService } from '../metrics/metrics.service.js';
import type { ScheduleEmailPayload } from './mail.types.js';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();
  private readonly templatesDir: string;
  private readonly timezone: string;
  private readonly mailFrom: string;
  private readonly mailFromName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    this.templatesDir =
      this.config.get<string>('TEMPLATES_DIR') ?? join(process.cwd(), 'templates');
    this.timezone = this.config.getOrThrow<string>('MAIL_TIMEZONE');
    this.mailFrom = this.config.getOrThrow<string>('MAIL_FROM');
    this.mailFromName = this.config.getOrThrow<string>('MAIL_FROM_NAME');
  }

  async onModuleInit(): Promise<void> {
    const host = this.config.getOrThrow<string>('SMTP_HOST');
    const port = this.config.getOrThrow<number>('SMTP_PORT');
    const secure = this.config.getOrThrow<boolean>('SMTP_SECURE');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    try {
      await this.getTemplate('schedule-created');
      await this.getTemplate('schedule-deleted');
      this.logger.log(`SMTP transport initialised for ${host}:${port}`);
    } catch (error) {
      this.logger.warn(
        `Preloading email templates failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async sendScheduleNotification(payload: ScheduleEmailPayload): Promise<void> {
    const isCreated = payload.event === 'schedule.created';
    const templateName = isCreated ? 'schedule-created' : 'schedule-deleted';
    const template = await this.getTemplate(templateName);

    const scheduledDate = new Date(payload.scheduledAt);
    const scheduledAtFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(scheduledDate);

    const templateContext = {
      ...payload,
      scheduledAtFormatted,
    };

    const html = template(templateContext);
    const subject = isCreated
      ? `Appointment Confirmation: Dr. ${payload.doctor.name}`
      : `Appointment Cancelled: Dr. ${payload.doctor.name}`;

    const text = isCreated
      ? `Dear ${payload.customer.name},\n\nYour appointment with Dr. ${payload.doctor.name} has been scheduled for ${scheduledAtFormatted}.\n\nAppointment ID: ${payload.scheduleId}\nObjective: ${payload.objective}\n\nHealthcare Clinic`
      : `Dear ${payload.customer.name},\n\nYour appointment with Dr. ${payload.doctor.name} on ${scheduledAtFormatted} has been cancelled.\n\nAppointment ID: ${payload.scheduleId}\nObjective: ${payload.objective}\n\nHealthcare Clinic`;

    await this.transporter.sendMail({
      from: `"${this.mailFromName}" <${this.mailFrom}>`,
      to: payload.customer.email,
      subject,
      text,
      html,
    });

    this.metrics.recordEmailSent(payload.event);
    this.logger.log(
      `Sent ${payload.event} email to ${payload.customer.email} for schedule ${payload.scheduleId}`,
    );
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  private async getTemplate(name: string): Promise<Handlebars.TemplateDelegate> {
    const existing = this.templateCache.get(name);
    if (existing) {
      return existing;
    }

    const templatePath = join(this.templatesDir, `${name}.hbs`);
    const content = await readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(content);
    this.templateCache.set(name, compiled);
    return compiled;
  }
}
