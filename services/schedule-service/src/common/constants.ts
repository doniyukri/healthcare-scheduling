export const CACHE_NAMESPACES = {
  customers: 'customers',
  doctors: 'doctors',
  schedules: 'schedules',
} as const;

export type CacheNamespace = (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES];

export const RATE_LIMITS = {
  global: { ttl: 60_000, limit: 100 },
} as const;

export const NOTIFICATION_JOBS = {
  scheduleCreated: 'schedule.created',
  scheduleDeleted: 'schedule.deleted',
} as const;

export type NotificationJobName =
  (typeof NOTIFICATION_JOBS)[keyof typeof NOTIFICATION_JOBS];
