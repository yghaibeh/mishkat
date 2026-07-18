-- إشعارات داخل الموقع: وقت القراءة (null = غير مقروء)
ALTER TABLE notifications ADD COLUMN read_at INTEGER;
