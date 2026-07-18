-- العمل دون اتصال: معرّفٌ ثابت من العميل (client_uuid) لجعل إعادة الإرسال idempotent.
-- (daily_entries.client_uuid موجودٌ أصلًا؛ نضيفه للدروس والمرفقات.)
ALTER TABLE lesson_sessions ADD COLUMN client_uuid TEXT;
ALTER TABLE attachments ADD COLUMN client_uuid TEXT;
ALTER TABLE lesson_attachments ADD COLUMN client_uuid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ls_client_uuid ON lesson_sessions(client_uuid) WHERE client_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_att_client_uuid ON attachments(client_uuid);
