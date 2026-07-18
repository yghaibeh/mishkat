-- حوافز تشغيلية (المادة 9-ب) باسمٍ نصّي حرّ (اتساقاً مع نمط الخصوصية)؛ person_id قد يكون فارغاً
ALTER TABLE incentives ADD COLUMN recipient_name TEXT;
