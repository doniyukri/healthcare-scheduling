#!/usr/bin/env node
/**
 * Waits until every service health endpoint reports a healthy status.
 * Used by `npm run stack:wait` and by the smoke-test workflow.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS ?? 180_000);
const POLL_INTERVAL_MS = Number(process.env.HEALTH_POLL_MS ?? 2_000);

const targets = [
  { name: 'auth', url: process.env.AUTH_HEALTH_URL ?? 'http://localhost:3001/health' },
  { name: 'schedule', url: process.env.SCHEDULE_HEALTH_URL ?? 'http://localhost:3002/health' },
  { name: 'notification', url: process.env.NOTIFICATION_HEALTH_URL ?? 'http://localhost:3003/health' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function probe(target) {
  try {
    const response = await fetch(target.url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const body = await response.json().catch(() => ({}));
    const status = body?.status ?? 'ok';
    return { ok: status !== 'error' && status !== 'down', reason: status };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const deadline = Date.now() + DEFAULT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const results = await Promise.all(targets.map(async (target) => ({ target, result: await probe(target) })));
    for (const { target, result } of results) {
      console.log(`${result.ok ? 'ok  ' : 'wait'} ${target.name.padEnd(12)} ${target.url} (${result.reason})`);
    }
    if (results.every(({ result }) => result.ok)) {
      console.log('All services are healthy.');
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.error(`Timed out after ${DEFAULT_TIMEOUT_MS}ms waiting for services.`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
