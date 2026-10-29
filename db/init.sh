#!/bin/bash
set -e
echo "Initializing Northwind database..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/northwind.sql
echo "Northwind database initialized successfully."