// تهريب HTML للنصوص التي يتحكّم بها المستخدم قبل حقنها في سلسلة HTML خارج حماية React
// (نوافذ الطباعة عبر Blob/window.open). أسماء الطلاب والملاحظات والعناوين تمرّ من هنا.
export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
