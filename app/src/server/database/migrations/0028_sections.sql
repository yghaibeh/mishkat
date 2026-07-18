-- الفصل التام بين قسمَي الذكور والنساء: القسم بُعدٌ أوّل على الشجرة.
-- section ∈ (men | women)، يُورَّث للأبناء ويُعزل تمامًا تحت الإدارة العليا.
-- الأنواع الجديدة: 'section' (جذر القسم) و 'halaqa' (ورقة قسم النساء) — قيم نصّية، لا تغيير على العمود.
ALTER TABLE org_units ADD COLUMN section TEXT NOT NULL DEFAULT 'men';
CREATE INDEX IF NOT EXISTS idx_org_units_section ON org_units(section);
