/**
 * عقود المستودعات — ADR-001 §٥ حكم ع-١: «الميزات تنادي مستودعاتٍ معلنة فقط».
 *
 * هذه **عقودٌ لا تنفيذ**: التنفيذ يأتي مع المخطط في مهمةٍ تالية، بعد حسم مفتاح
 * التوجيه (ع-٥) الذي هو نقطة اللاعودة. العقد هنا يثبّت الشكل الذي تعتمد عليه الخدمات
 * فلا تُكتب ميزةٌ واحدة على استيراد مباشر لمكتبة القاعدة.
 */

/** كل جدول عمليات يحمل مفتاح توجيه منذ أول هجرة (ع-٥). */
export type RoutingKey = {
  /** مسار الوحدة المادي — عليه يقوم كل منطق نطاق وكل تقسيمٍ محتمل لاحقاً. */
  readonly unitPath: string
}

export type OrgUnitRow = RoutingKey & {
  readonly id: string
  readonly type: string
  readonly parentId: string | null
  readonly archived: boolean
}

export type OrgUnitRepository = {
  byId(id: string): Promise<OrgUnitRow | null>
  byPath(path: string): Promise<OrgUnitRow | null>
  children(path: string): Promise<readonly OrgUnitRow[]>
}

export type AssignmentRow = RoutingKey & {
  readonly personId: string
  readonly roleId: string
  readonly startDate: Date
  readonly endDate: Date | null
  readonly approvalStatus: string
}

export type AssignmentRepository = {
  /** استعلامٌ واحد مفهرس على `personId` — لقطة الصلاحية عند الدخول (§٤.٥). */
  activeForPerson(personId: string, at: Date): Promise<readonly AssignmentRow[]>
}

export type AuditEntry = RoutingKey & {
  readonly id: string
  /** **زمن الخادم** لا زمن العميل (ب-٣٩هـ). */
  readonly at: Date
  readonly actorPersonId: string
  /** أدواره **لحظتها** — لقطة نصية لا مرجع يتغير لاحقاً. */
  readonly actorRolesAtTime: readonly string[]
  readonly impersonatedBy: string | null
  readonly action: string
  readonly capability: string
  readonly decision: "allowed" | "denied"
  readonly reasonCode: string
  readonly targetType: string
  readonly targetId: string
  readonly before: string | null
  readonly after: string | null
  readonly reason: string | null
  readonly requestId: string
}

export type AuditRepository = {
  /** يُكتب ولا يُعدَّل ولا يُحذف (المادة ٧/٤). لا `update` ولا `delete` في العقد أصلاً. */
  append(entry: AuditEntry): Promise<void>
  /** **معزول بالنطاق عند القراءة** — يقفل ت-٣. */
  listInScope(scopePath: string, limit: number): Promise<readonly AuditEntry[]>
}

export type Repositories = {
  readonly orgUnits: OrgUnitRepository
  readonly assignments: AssignmentRepository
  readonly audit: AuditRepository
}
