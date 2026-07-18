// أدوات المسار المادّي للشجرة التنظيمية
// path شكلها: /a/b/c/  حيث a..c معرّفات الوحدات من الجذر إلى العقدة (c = العقدة نفسها)

// مسار عقدة جديدة تحت أب (الجذر: parentPath = null)
export function buildChildPath(parentPath: string | null, id: string): string {
  return `${parentPath ?? '/'}${id}/`
}

// معرّفات العقدة وكل آبائها (الجذر أولاً)، آخر عنصر = العقدة نفسها
export function selfAndAncestorIds(path: string): string[] {
  return path.split('/').filter(Boolean)
}

// معرّفات الآباء فقط (تستثني العقدة نفسها) — الجذر أولاً
export function ancestorIds(path: string): string[] {
  return selfAndAncestorIds(path).slice(0, -1)
}

// نمط LIKE لكل ما تحت هذا المسار (شاملاً العقدة)
export function descendantPattern(path: string): string {
  return `${path}%`
}

// هل targetPath يقع ضمن scopePath (نفسه أو تحته)؟
export function isWithin(targetPath: string, scopePath: string): boolean {
  return targetPath.startsWith(scopePath)
}
