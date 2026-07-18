// منطق منهاج «على بصيرة» (محتوى ثابت) — شجرة خفيفة + محتوى درسٍ عند الطلب. عامّ (بلا تسجيل دخول).
import { asc, eq } from "drizzle-orm";
import { useDb } from "./utils/db";
import { manhajUnits, manhajLessons } from "./database/schema";

// كتلة محتوى (مطابقة لـcomponents/manhaj/render) — نوعٌ صريح ليقبله غلاف serverFn
type Block =
  | { type: "heading"; role?: string; text: string }
  | { type: "paragraph"; md?: string; inline?: Array<{ t: string; s: string; narrator?: string; source?: string; role?: string }>; item_role?: string }
  | { type: "table"; rows?: string[][]; html?: string }
  | { type: "image"; src: string; caption?: string };

// الشجرة: الوحدات + عناوين الدروس فقط (بلا blocks) — حمولة صغيرة سريعة.
export async function manhajTreeData() {
  const db = useDb();
  const units = await db.select({ id: manhajUnits.id, title: manhajUnits.title }).from(manhajUnits).orderBy(asc(manhajUnits.ord)).all();
  const lessons = await db.select({ id: manhajLessons.id, unitId: manhajLessons.unitId, title: manhajLessons.title })
    .from(manhajLessons).orderBy(asc(manhajLessons.ord)).all();
  const byUnit = new Map<string, { id: string; title: string }[]>();
  for (const l of lessons) {
    const arr = byUnit.get(l.unitId) ?? [];
    arr.push({ id: l.id, title: l.title });
    byUnit.set(l.unitId, arr);
  }
  return { units: units.map((u) => ({ id: u.id, title: u.title, lessons: byUnit.get(u.id) ?? [] })) };
}

// محتوى درسٍ واحد (مع اسم وحدته) — يُجلب عند فتح الدرس.
export async function manhajLessonData(id: string) {
  const db = useDb();
  const l = (await db.select().from(manhajLessons).where(eq(manhajLessons.id, id)).all())[0];
  if (!l) return null;
  const u = (await db.select({ title: manhajUnits.title }).from(manhajUnits).where(eq(manhajUnits.id, l.unitId)).all())[0];
  let blocks: Block[] = [];
  try { blocks = JSON.parse(l.blocks) as Block[]; } catch { /* */ }
  return {
    id: l.id, unitTitle: u?.title ?? "", title: l.title, subject: l.subject,
    durationMin: l.durationMin, hadithCount: l.hadithCount, quranCount: l.quranCount, blocks,
  };
}
