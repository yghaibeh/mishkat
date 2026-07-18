-- قرار اللجنة: «المسجد المؤثر» اسم المسجد الفعّال لا نوعُ حلقة — يُستبدل بنوع «علمية».
UPDATE circles SET type = 'ilmiyya' WHERE type = 'influential_mosque';
