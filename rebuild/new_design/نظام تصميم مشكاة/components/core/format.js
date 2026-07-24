// تحويل الأرقام إلى عربية-هندية — يُستعمل في كل المكوّنات
export function arabicNum(n) {
  const d = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(n).replace(/[0-9]/g, (c) => d[+c]);
}
