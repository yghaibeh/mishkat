-- هجرة المصادقة الثنائية (MFA) — إضافة أعمدة على users
ALTER TABLE users ADD COLUMN mfa_secret TEXT;
ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0;
