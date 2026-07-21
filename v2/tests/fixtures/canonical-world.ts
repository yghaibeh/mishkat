/**
 * العالم القانوني — TESTING_POLICY §٥.
 *
 * عالم بيانات **واحد محكوم** يُبنى بسكربت واحد (لا بذور متفرقة — درس v1، ج-٥).
 * **حتمي**: لا عشوائية ولا تواريخ زمن-تشغيل — فالفشل قابل لإعادة الإنتاج دائماً.
 * **ت-٢ محترمة**: مقاطع المسار المادي **هي** معرفات الوحدات — يبنيها `childPath` لا سلسلة حرة.
 *
 * تغيير هذا الملف تغييرٌ حساس يمسّ كل الاختبارات ⇒ يتطلب مراجعة مدير البرنامج.
 */

import type { Actor, Assignment, Override } from "../../src/authorization/can.js"
import type { RoleId, UnitTypeId } from "../../src/authorization/generated/roles.generated.js"
import { ROOT_PATH } from "../../src/authorization/scope.js"

/** كل تواريخ العالم مثبتة — لا `new Date()` بلا وسيط في أي موضع. */
const EPOCH = {
  assignmentStart: new Date("2026-01-01T00:00:00.000Z"),
  overrideStart: new Date("2026-01-01T00:00:00.000Z"),
  endedAssignment: new Date("2026-05-01T00:00:00.000Z"),
} as const

export type WorldUnit = {
  readonly id: string
  readonly type: UnitTypeId
  readonly ar: string
  readonly parentId: string | null
  readonly path: string
}

export type WorldWorld = {
  readonly units: readonly WorldUnit[]
  readonly people: readonly Actor[]
}

/** بناء المسار دالةٌ لا سلسلة حرة — تفعيلٌ لدرس ت-٢ («اجعل بناء المسار دالة»). */
function childPath(parentPath: string, id: string): string {
  return `${parentPath}${id}/`
}

export function buildCanonicalWorld(): WorldWorld {
  const units: WorldUnit[] = []

  function unit(id: string, type: UnitTypeId, ar: string, parent: WorldUnit | null): WorldUnit {
    const path = parent === null ? ROOT_PATH : childPath(parent.path, id)
    const u: WorldUnit = { id, type, ar, parentId: parent?.id ?? null, path }
    units.push(u)
    return u
  }

  // ── الشجرة ───────────────────────────────────────────────────────────────
  const root = unit("root", "root", "الشبكة", null)
  const men = unit("men", "section", "قسم الشباب", root)
  const women = unit("women", "section", "قسم الأشبال النسائي", root)

  const homs = unit("homs", "region", "منطقة حمص", men)

  // مربع مكلَّف (السلّم مكتمل تحته)…
  const sq2 = unit("sq2", "square", "المربع الثاني", homs)
  const khalid = unit("khalid", "mosque", "مسجد خالد بن الوليد", sq2)
  unit("c1", "circle", "حلقة خالد الأولى", khalid)
  const bilal = unit("bilal", "mosque", "مسجد بلال", sq2)

  // …ومربع **شاغر عمداً** (لاختبار NESSA وكسر الزجاج): لا مكلَّف عليه إطلاقاً.
  const sq7 = unit("sq7", "square", "المربع السابع (شاغر عمداً)", homs)
  const omar = unit("omar", "mosque", "مسجد عمر", sq7)
  unit("c2", "circle", "حلقة عمر الأولى", omar)

  // ── الناس ────────────────────────────────────────────────────────────────
  const people: Actor[] = []

  function assign(roleId: RoleId, scopePath: string, over: Partial<Assignment> = {}): Assignment {
    return {
      roleId,
      scopePath,
      startDate: EPOCH.assignmentStart,
      endDate: null,
      approvalStatus: "approved",
      unitArchived: false,
      ...over,
    }
  }

  function person(
    personId: string,
    assignments: Assignment[],
    overrides: Override[] = [],
  ): Actor {
    const a: Actor = {
      personId,
      accountStatus: "active",
      sessionEpoch: 1,
      currentSessionEpoch: 1,
      assignments,
      overrides,
    }
    people.push(a)
    return a
  }

  // مستخدم قانوني لكل دور حيّ من العشرة، بأسماء ثابتة معبّرة.
  person("u-admin", [assign("admin", root.path)])
  person("u-section-head", [assign("section_head", men.path)])
  person("u-rabita", [assign("rabita", homs.path)])
  person("u-square", [assign("square", sq2.path)])
  person("u-amir", [assign("amir", khalid.path)])
  person("u-amir-bilal", [assign("amir", bilal.path)])
  person("u-amir-omar", [assign("amir", omar.path)])
  person("u-teacher", [assign("teacher", childPath(khalid.path, "c1"))])
  person("u-committee-head", [assign("committee_head", khalid.path)])
  // المالي والإعلامي على **الجذر صراحةً** — النطاق العابر للقسمين (ب-٢٦، ع-١):
  // قرارٌ معلن مُدوَّن، لا التفافٌ كما كان في بذرة v1 (ج-٣).
  person("u-media", [assign("media", root.path)])
  person("u-finance", [assign("finance_officer", root.path)])
  person("u-student", [assign("student", childPath(khalid.path, "c1"))])

  // الثلاثة الخاصون (TESTING_POLICY §٥):
  // ١) ذو منحة فوق دوره
  person(
    "u-granted",
    [assign("square", sq2.path)],
    [
      {
        capId: "finance.view",
        scopePath: sq2.path,
        effect: "grant",
        startDate: EPOCH.overrideStart,
        endDate: null,
        reason: "تفويض مالي مؤقت لمسؤول المربع أثناء شغور المالي",
      },
    ],
  )

  // ٢) ذو حجب تحت دوره — والحجب يغلب دائماً
  person(
    "u-blocked",
    [assign("rabita", homs.path)],
    [
      {
        capId: "audit.view",
        scopePath: homs.path,
        effect: "deny",
        startDate: EPOCH.overrideStart,
        endDate: null,
        reason: "حجب سجل التدقيق أثناء تحقيق جارٍ",
      },
    ],
  )

  // ٣) ذو دورين بنطاقين مختلفين — اتحاد القدرات بلا تسريب بين النطاقين
  person("u-dual", [assign("amir", khalid.path), assign("teacher", childPath(omar.path, "c2"))])

  // شخصٌ على دور موقوف (ملحق ب/٣) — لاختبار `DENIED_ROLE_SUSPENDED` لا الصمت
  person("u-suspended-role", [assign("secretary", khalid.path)])

  // شخصٌ انتهى تكليفه — لاختبار السقوط الفوري (ق-٢٤)
  person("u-ended", [assign("amir", bilal.path, { endDate: EPOCH.endedAssignment })])

  // شخصٌ تكليفه معلّق — لا يدخل حساب القدرات إطلاقاً (ق-١٤/ق-٢٥)
  person("u-pending", [assign("amir", omar.path, { approvalStatus: "pending" })])

  void women

  return { units, people }
}
