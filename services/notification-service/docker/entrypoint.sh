#!/bin/sh
set -eu

echo "[entrypoint] starting notification-service"
exec node dist/main.js
