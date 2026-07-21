#!/bin/sh
set -e

echo "Waiting for PostgreSQL at ${DB_HOST:-db}:${DB_PORT:-5432}..."
python - << 'PY'
import os, socket, time
host, port = os.environ.get("DB_HOST", "db"), int(os.environ.get("DB_PORT", "5432"))
for _ in range(60):
    try:
        socket.create_connection((host, port), timeout=2).close()
        break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("Database never became available")
PY

echo "Applying migrations..."
python manage.py migrate --noinput

# If a custom command was passed (e.g. createsuperuser, pytest), run it instead.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

echo "Seeding demo data..."
# python manage.py seed_demo

echo "Starting Django on 0.0.0.0:8000"
exec python manage.py runserver 0.0.0.0:8000
