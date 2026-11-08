#!/bin/sh
set -eu

echo "[entrypoint] applying database migrations"
./node_modules/.bin/prisma migrate deploy

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[entrypoint] seeding demo data"
  node dist/prisma/seed.js
fi

echo "[entrypoint] starting schedule-service"
exec node dist/main.js
