import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text-summary", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/generated/**", "src/routes/**"],
      thresholds: {
        // TESTING_POLICY §٣ — أرضية تصعد ولا تهبط
        lines: 85,
        branches: 85,
        "src/authorization/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        // **سجلُّ التدقيق الواحد** (T26-أ/CR-027): مِرفقٌ تناديه الوحداتُ الخمسَ عشرةَ كلُّها،
        // وفيه يعيش حارسُ «لا فعلَ بلا نطاق» — فخطؤه يُصمِت سجلاً لا يُكشف إلا في تحقيق.
        // ⇒ عتبتُه ٩٥٪ (وهو اليوم ١٠٠٪؛ والعتبةُ أرضيةٌ تصعد ولا تهبط — §٣).
        "src/audit/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        // **طبقةُ الاستمرار تحت المال كلِّه** (T25): الذرّية ومفتاحُ التوجيه وعزلُ الشبكة
        // تعيش هنا، وخطؤها لا يظهر إلا بعد أن يُكتب — ⇒ عتبتُها ٩٥٪ (أرضيةٌ تصعد، §٣).
        "src/db/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **المال لا يُساهَل فيه** (T7): خدماتُ الدفتر عتبتُها ٩٥٪ أسطراً وأفرعاً.
        "src/features/ledger/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        // وطبقةُ بياناتِه معها — فثوابتُ الذرّية والتكامل المرجعيّ تعيش هناك.
        "src/features/ledger/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والصندوقُ مالٌ كذلك** (T8): خدماتُه عتبتُها ٩٥٪، وطبقةُ بياناته معها.
        "src/features/box/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/box/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **ومحرّكُ الاعتماد قلبُ النظام** (T9/قب-٢٩): كلُّ موافقةٍ تمرّ به ⇒ عتبتُه ٩٥٪.
        "src/features/approval/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        "src/features/approval/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والنقاطُ مالٌ مباشرةً** (ق-٣٣، T10): خدماتُ سجل اليوم عتبتُها ٩٥٪، وطبقةُ بياناته معها.
        "src/features/dailyLog/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        // **وسلسلةُ ق-١٣ تمرّ بوحدة اللجان** (T12): بياناتُ اللجنة مدخلُ سجل المسجد،
        // فخطؤها يُحتسب نقاطاً ⇒ عتبتُها ٩٥٪ كالمال والاعتماد (والعتبةُ أرضيةٌ تصعد — §٣).
        "src/features/committees/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        "src/features/dailyLog/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والعُهدةُ أمانةٌ في رقبة إنسان** (ق-٧٨…ق-٨٣، T14): خدماتُها عتبتُها ٩٥٪، وطبقةُ
        // بياناتها معها — فسلسلةٌ لا تُمحى تُختبر كما يُختبر المال.
        // **والزيارةُ عملُ المشرف الميدانيّ** (ق-٩٩، T11): خدماتُ الإشراف عتبتُها ٩٥٪ كذلك.
        "src/features/supervision/services/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        "src/features/custody/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        "src/features/custody/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        "src/features/supervision/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        "src/features/committees/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والمحتوى المنشور لا يُسترجَع بعد أن يُرى** (T13): خدماتُ الإعلام — النسبةُ والعزلُ
        // وتحقّقُ الرفع — عتبتُها ٩٥٪، وطبقةُ بياناتها معها.
        "src/features/media/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/media/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والحلقةُ قلبُ عمل المسجد** (ب-٢٨، T16): كيانٌ واحدٌ نوعُه صفة، وكلُّ عددٍ فيه
        // اشتقاقٌ لا عدّاد ⇒ خدماتُه عتبتُها ٩٥٪، وطبقةُ بياناته معها (والعتبةُ أرضيةٌ تصعد).
        "src/features/circles/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/circles/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والمكتبةُ توجيهٌ وخطُّ زمنٍ يُتابَع عليه إنسان** (ق-٩٦، T20): جمهورُ المادة
        // وبلوغُها وخَتماتُها الثلاث — خطؤها يُطالِب بريئاً أو يُعفي مقصّراً ⇒ عتبتُها ٩٥٪،
        // وطبقةُ بياناتها معها (والعتبةُ أرضيةٌ تصعد ولا تهبط — TESTING_POLICY §٣).
        "src/features/library/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/library/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والإشعارُ يخرج من النظام إلى هاتفٍ خارجه** (T21): مَن يُشعَر جوابُ المحرّك (ق-١١/ق-٢٥)،
        // وخطؤه لا يُسترجَع بعد أن يصل — فخدماتُه عتبتُها ٩٥٪، وطبقةُ بياناته معها (والعتبةُ أرضيةٌ تصعد).
        "src/features/notifications/services/**": {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
        "src/features/notifications/data/**": {
          lines: 95,
          branches: 90,
          functions: 95,
          statements: 95,
        },
        // **وسجلُّ الحلقة اليوميّ يحمل علامةَ طالبٍ ورمزَ وليّ أمرِه** (ق-٩٠…ق-٩٣، T18):
        // خطؤه يُصيب تقييماً وتقديراً وبياناتِ قاصر ⇒ خدماتُه عتبتُها ٩٥٪، وطبقةُ بياناته معها.
        "src/features/circleLog/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/circleLog/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والدرسُ يحمل مالَ المعلّم وتقدّمَ الطالب** (ق-٨٦/ق-٩٢، T19): خدماتُ «على بصيرة»
        // عتبتُها ٩٥٪، وطبقةُ بياناتها معها — فالاشتقاقُ الماليُّ يُختبر كما يُختبر المال.
        "src/features/education/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/education/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
        // **والراتبُ مالٌ يصل يدَ إنسان** (ب-١٠، T23): اشتقاقُ المستحق وختمُه وصرفُه —
        // خطؤه إمّا يُجوّع مستحقّاً وإمّا يدفع مرتين ⇒ خدماتُه عتبتُها ٩٥٪، وطبقةُ بياناته
        // معها (والعتبةُ أرضيةٌ تصعد ولا تهبط — TESTING_POLICY §٣).
        "src/features/payroll/services/**": { lines: 95, branches: 95, functions: 95, statements: 95 },
        "src/features/payroll/data/**": { lines: 95, branches: 90, functions: 95, statements: 95 },
      },
    },
  },
})
