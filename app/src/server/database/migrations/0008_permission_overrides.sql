CREATE TABLE IF NOT EXISTS permission_overrides (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  capability TEXT NOT NULL,
  effect TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_po_role_cap ON permission_overrides(role, capability);
