import type { NotificationJobName } from '../common/constants.js';

/**
 * Queue contract shared with the Notification Service.
 *
 * The payload is intentionally flat and self-contained: the worker must be able
 * to render an email without calling back into the Schedule Service.
 */
export interface ScheduleEmailPayload {
  event: NotificationJobName;
  scheduleId: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  doctor: {
    id: string;
    name: string;
  };
  objective: string;
  /** ISO-8601 UTC timestamp. */
  scheduledAt: string;
}
