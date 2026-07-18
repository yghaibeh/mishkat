-- تهذيب سجلّ التحفيظ: نطاق مُهيكَل (سورة/آية أو صفحات) + المنهج المصاحب من البرامج
ALTER TABLE tahfeez_daily_records ADD COLUMN hifz_mode TEXT;        -- surah | page
ALTER TABLE tahfeez_daily_records ADD COLUMN hifz_surah INTEGER;    -- رقم السورة (وضع السورة)
ALTER TABLE tahfeez_daily_records ADD COLUMN review_mode TEXT;
ALTER TABLE tahfeez_daily_records ADD COLUMN review_surah INTEGER;
ALTER TABLE tahfeez_daily_records ADD COLUMN companion_kind TEXT;   -- برنامج المصاحب (baseera|rashidi|...) أو 'other'
