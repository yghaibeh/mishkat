// إعداد Nuxt — منصة المسجد المؤثر (سباق S1)
// الخادم على Cloudflare (Nitro cloudflare-pages) + قاعدة بيانات D1.
export default defineNuxtConfig({
  compatibilityDate: '2024-09-23',
  modules: ['@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],

  // RTL عربي على مستوى المستند
  app: {
    head: {
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
      title: 'المسجد المؤثر',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },

  css: ['~/assets/css/main.css'],

  // النشر على Cloudflare Pages/Workers، مع تفعيل توافق Node داخل بيئة Workers
  nitro: {
    preset: 'cloudflare-pages',
  },

  runtimeConfig: {
    // تُضبط عبر متغيرات البيئة NUXT_* (لا تضع أسراراً حقيقية هنا)
    jwtSecret: '',
    telegramBotToken: '',
  },

  // Offline-first: PWA لإدخال السجل دون اتصال
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'المسجد المؤثر',
      short_name: 'المسجد المؤثر',
      lang: 'ar',
      dir: 'rtl',
      theme_color: '#0f6e56',
      background_color: '#ffffff',
      display: 'standalone',
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    },
  },

  typescript: { strict: true },
})
