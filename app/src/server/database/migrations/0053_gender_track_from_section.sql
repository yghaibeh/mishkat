-- ق٢ — توحيد نموذج الجنس: كان في org_units حقلان مستقلّان (section: men|women، gender_track: male|female)
-- يفترقان في بياناتٍ قديمة، فيُحسب مسجدٌ «أنثويّ المسار» في شبكة الرجال ويُرفض في سجلّ النساء.
-- القسمُ (section) هو مصدر الحقيقة الهرميّ — والمسارُ مشتقٌّ منه هنا وفي createOrgUnit من الآن.
UPDATE org_units SET gender_track = CASE WHEN section = 'women' THEN 'female' ELSE 'male' END
WHERE (section = 'women' AND gender_track != 'female') OR (section != 'women' AND gender_track != 'male');
