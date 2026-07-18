-- FR2.4 — اشتراكات Web Push (قناة إشعارٍ مكمّلة للمتصفّح/PWA)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,        -- مفتاح المتصفّح العموميّ (base64url)
  auth TEXT NOT NULL,          -- سرّ المصادقة (base64url)
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_person ON push_subscriptions (person_id);
