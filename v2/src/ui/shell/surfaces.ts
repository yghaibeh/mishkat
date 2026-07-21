/**
 * معجمُ السطوح وخريطةُ ترتيب الشريط — SPEC_information_architecture §٢.٢/§٢.٣ (ق-١١٤/ق-١١٥).
 *
 * **سطحٌ = مساحةٌ في القشرة يفتحها بابٌ** (قدرةٌ أو أكثر بـ`anyOf` — ق-٢٨). المعجمُ واحد،
 * فتستحيل شاشتان تسمّيان الشيء نفسه باسمين (مرضُ «الشبكة» في v1: اسمُ مسارٍ واسمُ مفهومٍ معاً).
 * التسميةُ المعتمدة لسطح الاستكشاف **«البيان»** (قب-٢٢).
 *
 * **خريطةُ الترتيب واحدةٌ محروسة** (وريثةُ `ROLE_NAV_ORDER` في v1): الدورُ يقرّر **الترتيب**
 * لا **الظهور** — الظهورُ إسقاطُ القدرات وحدها. ولذلك تُحسب الأولويةُ على الخادم (`navPriorityForRoles`)
 * وتُمرَّر إلى الواجهة قيمةً واحدة، فلا تعرف الواجهةُ دوراً أصلاً (المادة ٤/٦، G6).
 */

import type { CapId } from "../../authorization/generated/capabilities.generated.js"
import { ROLES, type RoleId } from "../../authorization/generated/roles.generated.js"
import type { TextKey } from "../text/dictionary.js"

export type SurfaceId =
  | "home"
  | "bayan"
  | "myMosque"
  | "myCircles"
  | "myCommittee"
  | "education"
  | "activities"
  | "library"
  | "manhaj"
  | "competition"
  | "family"
  | "box"
  | "centralFinance"
  | "custody"
  | "media"
  | "admin"
  | "personal"

export type Surface = {
  readonly id: SurfaceId
  readonly labelKey: TextKey
  readonly route: string
  /** بابُ السطح: `anyOf` — قائمةٌ فارغةٌ = مفتوحٌ لكل مسجَّل (الرئيسية/المنهاج/حسابي). */
  readonly openedBy: readonly CapId[]
  /** الترتيبُ الأساسيّ قبل أولوية الدور. */
  readonly order: number
  /** سطحٌ فرعيٌّ داخل صفحة الوحدة لا في القشرة العامة (IA ق-م.هـ). */
  readonly withinUnitPage?: boolean
}

export const SURFACES: readonly Surface[] = Object.freeze([
  { id: "home", labelKey: "nav.home", route: "/home", openedBy: [], order: 0 },
  { id: "bayan", labelKey: "nav.bayan", route: "/bayan", openedBy: ["network.view"], order: 10 },
  {
    // «مسجدي» بابُ الأمير الأول (IA §٢.٣): يصل التعليمَ والصندوقَ والأسرة من صفحة مسجده.
    id: "myMosque",
    labelKey: "nav.myMosque",
    route: "/mosque",
    openedBy: ["circle.manage"],
    order: 11,
  },
  {
    id: "myCircles",
    labelKey: "nav.myCircles",
    route: "/my-circles",
    openedBy: ["circle.teach"],
    order: 12,
  },
  {
    id: "myCommittee",
    labelKey: "nav.myCommittee",
    route: "/my-committee",
    openedBy: ["committee.own"],
    order: 13,
  },
  {
    id: "education",
    labelKey: "nav.education",
    route: "/education",
    openedBy: ["circle.view"],
    order: 20,
    withinUnitPage: true,
  },
  {
    id: "activities",
    labelKey: "nav.activities",
    route: "/activities",
    // «المطلوب مني» بابُ الطالب هنا كذلك (عدسة §٢.١٠): `exam.take` تفتح السطحَ لحاملها.
    openedBy: ["duties.manage", "exam.manage", "exam.take"],
    order: 30,
  },
  {
    id: "library",
    labelKey: "nav.library",
    route: "/library",
    openedBy: ["library.own", "library.manage"],
    order: 40,
  },
  { id: "manhaj", labelKey: "nav.manhaj", route: "/manhaj", openedBy: [], order: 50 },
  {
    id: "competition",
    labelKey: "nav.competition",
    route: "/competition",
    openedBy: ["competition.view"],
    order: 60,
  },
  {
    id: "family",
    labelKey: "nav.family",
    route: "/family",
    openedBy: ["committees.view", "meetings.view"],
    order: 70,
    withinUnitPage: true,
  },
  {
    id: "box",
    labelKey: "nav.box",
    route: "/box",
    openedBy: ["box.view", "mosqueFinance.view"],
    order: 80,
    withinUnitPage: true,
  },
  {
    id: "centralFinance",
    labelKey: "nav.centralFinance",
    route: "/finance",
    // يفتحه أيضاً مَن له الاعتمادُ أو التصديرُ دون عرض الدفتر (رؤوس الأقسام — §٣.٣).
    openedBy: ["finance.view", "finance.approve", "finance.export"],
    order: 90,
  },
  { id: "custody", labelKey: "nav.custody", route: "/custody", openedBy: ["custody.view"], order: 100 },
  { id: "media", labelKey: "nav.media", route: "/media", openedBy: ["media.hub"], order: 110 },
  {
    // بابُ الإدارة يُفتح بـ**أيّ** قدرة تهيئة (ق-٢٨ `anyOf`) — لا بقدرةٍ واحدةٍ حصراً.
    id: "admin",
    labelKey: "nav.admin",
    route: "/admin",
    openedBy: [
      "admin.view",
      "orgUnit.manage",
      "orgUnit.manage.root",
      "users.provision",
      "permissions.manage",
      "settings.view",
      "audit.view",
      "featureFlag.manage",
      "activityCatalog.manage",
    ],
    order: 120,
  },
  { id: "personal", labelKey: "nav.personal", route: "/account", openedBy: [], order: 999 },
])

export const SURFACE_IDS: readonly SurfaceId[] = Object.freeze(SURFACES.map((s) => s.id))

/** كل القدرات التي تفتح سطحاً — تُحسب على الخادم وتُرسل قشرةً للواجهة (§٤.٥). */
export const SURFACE_GATE_CAPS: readonly CapId[] = Object.freeze([
  ...new Set(SURFACES.flatMap((s) => s.openedBy)),
])

/**
 * ما يلي «الرئيسية» لكل دور (ق-١١٥) — **خريطةٌ واحدةٌ محروسة**؛ ودورٌ جديدٌ بلا مدخلٍ
 * فيها **خطأُ بناء** (النوع `Record<RoleId, …>` يفرضه). الأدوارُ الموقوفة مُدرَجةٌ كي تجهز
 * عند التفعيل، ولا أثرَ لها ما دامت قدراتُها لا تُسقَط (`DENIED_ROLE_SUSPENDED`).
 */
export const ROLE_NAV_ORDER: Readonly<Record<RoleId, SurfaceId>> = Object.freeze({
  admin: "admin",
  section_head: "bayan",
  bloc_head: "bayan",
  rabita: "bayan",
  square: "bayan",
  amir: "myMosque",
  teacher: "myCircles",
  committee_head: "myCommittee",
  media: "media",
  finance_officer: "centralFinance",
  student: "activities",
  deputy: "myMosque",
  secretary: "myMosque",
  treasurer: "box",
  member: "personal",
  participant: "competition",
})

/**
 * أولويةُ الشريط لفاعلٍ بأدوارٍ متعددة: **الدورُ الأعلى رتبةً يغلب** (IA §٢.٣).
 * تُستدعى على الخادم مع لقطة الجلسة، وتُمرَّر للواجهة قيمةً واحدة لا قائمةَ أدوار.
 */
export function navPriorityForRoles(roleIds: readonly RoleId[]): SurfaceId | null {
  const active = roleIds.filter((r) => ROLES[r].state === "active")
  if (active.length === 0) return null
  const top = active.reduce((best, r) => (ROLES[r].rank < ROLES[best].rank ? r : best), active[0] as RoleId)
  return ROLE_NAV_ORDER[top]
}
