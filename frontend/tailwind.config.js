/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Newsreader', 'Charter', 'Iowan Old Style', 'Georgia', 'serif'],
        serif: ['Newsreader', 'Charter', 'Georgia', 'serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        obli: {
          'primary': '#D48E11',
          'primary-content': '#ffffff',
          'secondary': '#1f2937',
          'secondary-content': '#ffffff',
          'accent': '#374151',
          'accent-content': '#ffffff',
          'neutral': '#111827',
          'neutral-content': '#f9fafb',
          'base-100': '#ffffff',
          'base-200': '#f7f7f7',
          'base-300': '#f0f0f0',
          'base-content': '#111111',
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