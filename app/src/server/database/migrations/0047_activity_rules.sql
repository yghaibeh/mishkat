-- قواعد النقاط (قرار اللجنة بعد التجربة الميدانيّة):
-- ١) سقفٌ يوميّ لكلّ نشاط (الصلوات الخمس = نقطة واحدة في اليوم مهما تكرّر الإدخال).
-- ٢) عتبة مشاركة: لا تُحسب نقطة الصلاة إن صلّى أقلُّ من ٧٠٪ من طلاب الأسرة المسجّلين.
-- ٣) عدد طلاب الأسرة المسجّلين لكلّ مسجدٍ (يضبطه الأمير) — مرجع نسبة الالتزام.
ALTER TABLE activity_types ADD COLUMN max_per_day INTEGER;            -- NULL = بلا سقف
ALTER TABLE activity_types ADD COLUMN min_participation_pct INTEGER;  -- NULL = بلا عتبة
ALTER TABLE org_units ADD COLUMN family_students INTEGER;             -- طلاب الأسرة المسجّلون

UPDATE activity_types SET max_per_day = 1, min_participation_pct = 70 WHERE code = 'prayer';
