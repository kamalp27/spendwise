/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0B0F19',
          900: '#0F172A',
          850: '#151F32',
          800: '#1E293B',
        },
        slate: {
          light: '#F8FAFC',
          muted: '#94A3B8',
        },
      },
    },
  },
  plugins: [],
};
