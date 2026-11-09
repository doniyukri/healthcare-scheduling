-- Runs once, on an empty PostgreSQL data volume.
-- One instance, two isolated databases: database-per-service.

CREATE DATABASE auth_db;
CREATE DATABASE schedule_db;

COMMENT ON DATABASE auth_db IS 'Auth Service database';
COMMENT ON DATABASE schedule_db IS 'Schedule Service database';
