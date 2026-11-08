export const RATE_LIMITS = {
  global: { ttl: 60_000, limit: 100 },
  auth: { ttl: 60_000, limit: 5 },
} as const;
