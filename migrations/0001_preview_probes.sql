-- Client browser preview probe reports keyed by (run_id, round) for cross-isolate QA self-heal.
CREATE TABLE IF NOT EXISTS preview_probes (
  run_id TEXT NOT NULL REFERENCES runs(id),
  round INTEGER NOT NULL,
  report TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (run_id, round)
);
