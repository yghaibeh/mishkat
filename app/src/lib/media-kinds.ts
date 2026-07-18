// معجمُ أنواع التغطية — مصدرٌ واحدٌ للاسم والأيقونة (كمعجم فئات الموادّ): أيُّ نوعٍ جديدٍ
// يُضاف هنا وحدَه فيسري على النموذج والبطاقة والتصفية معًا، ويحرسه اختبارُ المعاجم.
import { CalendarDays, DoorOpen, PackageOpen, Footprints, BookOpen, Award } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const COVERAGE_KINDS = [
  { key: "event", label: "فعاليّة", Icon: CalendarDays },
  { key: "opening", label: "افتتاحٌ وتدشين", Icon: DoorOpen },
  { key: "distribution", label: "توزيعٌ وإغاثة", Icon: PackageOpen },
  { key: "visit", label: "زيارةٌ ميدانيّة", Icon: Footprints },
  { key: "lesson", label: "درسٌ ومحاضرة", Icon: BookOpen },
  { key: "ceremony", label: "تكريمٌ وتخريج", Icon: Award },
] as const;

export type CoverageKind = typeof COVERAGE_KINDS[number]["key"];
export const COVERAGE_KIND_KEYS = COVERAGE_KINDS.map((k) => k.key) as readonly string[];
export const coverageKindLabel = (key: string): string =>
  COVERAGE_KINDS.find((k) => k.key === key)?.label ?? key;
export const coverageKindIcon = (key: string): LucideIcon =>
  COVERAGE_KINDS.find((k) => k.key === key)?.Icon ?? CalendarDays;
