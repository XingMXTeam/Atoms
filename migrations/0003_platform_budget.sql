-- Platform-demo budget vs visitor BYOK.
-- Re-applied on every local SQLite open; duplicate-column errors are ignored by the adapter.
ALTER TABLE usage ADD COLUMN platform_runs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usage ADD COLUMN platform_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN billing TEXT NOT NULL DEFAULT 'mock';

CREATE TABLE IF NOT EXISTS device_demo (
  device_id TEXT PRIMARY KEY NOT NULL,
  platform_generations INTEGER NOT NULL DEFAULT 0
);
