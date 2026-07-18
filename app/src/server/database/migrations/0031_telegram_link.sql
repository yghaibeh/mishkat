-- إيصال الإشعارات عبر تيليغرام: رمز ربطٍ مؤقّت يلتقط chat_id للشخص عبر /start.
ALTER TABLE person_contacts ADD COLUMN link_token TEXT;
ALTER TABLE person_contacts ADD COLUMN link_expires INTEGER;
CREATE INDEX IF NOT EXISTS idx_pc_link_token ON person_contacts(link_token);
