import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // jsPDF carga «html2canvas»; usamos la versión que entiende los colores modernos (oklch)
  resolve: { alias: { html2canvas: 'html2canvas-pro' } },
})
