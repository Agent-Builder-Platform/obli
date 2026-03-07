/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        obli: {
          'primary': '#000000',
          'primary-content': '#ffffff',
          'secondary': '#1f2937',
          'secondary-content': '#ffffff',
          'accent': '#374151',
          'accent-content': '#ffffff',
          'neutral': '#111827',
          'neutral-content': '#f9fafb',
          'base-100': '#ffffff',
          'base-200': '#f9fafb',
          'base-300': '#f3f4f6',
          'base-content': '#111827',
          'info': '#3b82f6',
          'info-content': '#ffffff',
          'success': '#22c55e',
          'success-content': '#ffffff',
          'warning': '#f59e0b',
          'warning-content': '#ffffff',
          'error': '#ef4444',
          'error-content': '#ffffff',
        },
      },
    ],
    darkTheme: false,
  },
}