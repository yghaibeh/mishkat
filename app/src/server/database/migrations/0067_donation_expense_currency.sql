-- تعدّدُ العملات على الإدخال: التبرّعُ/المصروفُ يُسجَّل بعملته الأصليّة، ويُخزَّن `amount` بقيمته الدولاريّة.
-- currency = العملةُ الأصليّة (NULL/USD = دولار)، orig_amount = المبلغُ بالعملة الأصليّة.
ALTER TABLE donations ADD COLUMN currency TEXT;
ALTER TABLE donations ADD COLUMN orig_amount REAL;
ALTER TABLE expenses ADD COLUMN currency TEXT;
ALTER TABLE expenses ADD COLUMN orig_amount REAL;
