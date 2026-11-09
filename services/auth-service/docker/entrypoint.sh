#!/bin/sh
set -eu

# The service owns its database: apply committed migrations before serving.
echo "[entrypoint] applying database migrations"
./node_modules/.bin/prisma migrate deploy

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "[entrypoint] seeding demo data"
  node dist/prisma/seed.js
fi

echo "[entrypoint] starting auth-service"
exec node dist/main.js
