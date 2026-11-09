export interface ScheduleEmailPayload {
  event: 'schedule.created' | 'schedule.deleted';
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
