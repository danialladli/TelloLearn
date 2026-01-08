/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'tello-dark': '#0f172a', // Deep Navy (Backgrounds)
        'tello-card': '#1e293b', // Slightly lighter navy for cards
        'tello-accent': '#3b82f6', // Bright Blue for buttons/progress
        'tello-white': '#f8fafc', 
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Use a clean font like Inter
      }
    },
  },
  plugins: [],
}