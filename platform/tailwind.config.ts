import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0f6e56', light: '#1d9e75', dark: '#085041' },
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
    },
  },
}
