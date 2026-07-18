-- مرفقُ الإيصال على مطالبة الصرف: رابطٌ/مرجعٌ للفاتورة أو صورة الإيصال (سلسلةُ التوثيق للتدقيق).
ALTER TABLE expense_claims ADD COLUMN receipt_url TEXT;
