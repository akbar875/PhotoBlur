#!/bin/sh
set -eu

APP_PORT="${PORT:-7860}"

exec gunicorn backend.app:app --bind "0.0.0.0:${APP_PORT}" --workers 1 --timeout 120
