-- ٠٠٧٤ — الإقفال الدوري للصندوق (٣٩ §٦-٥): «استلمتُ كذا، وزّعت كذا، بقي كذا» يُقدَّم للأعلى فيعتمده.
CREATE TABLE IF NOT EXISTS box_closings (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL,
  month TEXT NOT NULL,                -- شهر هجري 1448-02
  summary TEXT NOT NULL,              -- JSON: { received:[{currency,amount}], spent:[...], handedDown:[...], remaining:[...] }
  status TEXT NOT NULL DEFAULT 'submitted',  -- submitted | approved
  submitted_by TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  approved_by TEXT,
  approved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bc_unit_month ON box_closings(unit_id, month);
CREATE INDEX IF NOT EXISTS idx_bc_status ON box_closings(status);
