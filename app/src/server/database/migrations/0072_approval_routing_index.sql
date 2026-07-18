-- ك١ (الوثيقة ٢٩): فهرسٌ يسرّع حسابَ «أقرب سلَفٍ إشرافيٍّ نشط» (NESSA) عند مئات الآلاف من التكليفات.
-- approverLayerFor يستعلم بـ (org_unit_id ضمن آباء المسار) + role إشرافيّ + نشطٌ معتمَد — هذا الفهرسُ يخدمه مباشرةً.
CREATE INDEX IF NOT EXISTS idx_ra_unit_role_active
  ON role_assignments (org_unit_id, role, end_date, approval_status);
