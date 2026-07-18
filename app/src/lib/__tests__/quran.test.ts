import { describe, it, expect } from "vitest";
import { SURAHS, TOTAL_PAGES, surahName, surahAyat, validAyahRange, validPageRange, SURAH_OPTIONS } from "@/lib/quran";

describe("مرجع القرآن", () => {
  it("١١٤ سورة بأرقامٍ متسلسلة وبيانات صحيحة", () => {
    expect(SURAHS.length).toBe(114);
    expect(SURAHS.map((s) => s.n)).toEqual(Array.from({ length: 114 }, (_, i) => i + 1));
    expect(surahName(1)).toBe("الفاتحة");
    expect(surahAyat(1)).toBe(7);
    expect(surahName(2)).toBe("البقرة");
    expect(surahAyat(2)).toBe(286);
    expect(surahName(114)).toBe("الناس");
    expect(TOTAL_PAGES).toBe(604);
    expect(SURAH_OPTIONS.length).toBe(114);
  });

  it("تحقّق نطاق الآيات ضمن السورة", () => {
    expect(validAyahRange(1, 1, 7)).toBe(true);     // الفاتحة كاملة
    expect(validAyahRange(1, 1, 8)).toBe(false);    // تتجاوز
    expect(validAyahRange(2, 250, 286)).toBe(true);
    expect(validAyahRange(2, 10, 5)).toBe(false);   // من > إلى
    expect(validAyahRange(999 as number, 1, 1)).toBe(false); // سورة غير موجودة
  });

  it("تحقّق نطاق الصفحات", () => {
    expect(validPageRange(1, 604)).toBe(true);
    expect(validPageRange(600, 605)).toBe(false);
    expect(validPageRange(50, 40)).toBe(false);
  });
});
