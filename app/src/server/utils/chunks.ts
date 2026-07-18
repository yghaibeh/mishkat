// دفعاتٌ ≤٩٠ تحت حدّ متغيّرات D1 (~١٠٠) — قاعدة المشروع لكلّ inArray قائمتُه غير محدودة.
export async function selectByIdChunks<R>(ids: string[], run: (batch: string[]) => Promise<R[]>, size = 90): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await run(ids.slice(i, i + size))));
  return out;
}
