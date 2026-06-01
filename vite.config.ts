import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  root: 'apps/erp-web',
  envDir: '.',
  plugins: [react()],
  build: {
    outDir: '../../dist/erp',
    emptyOutDir: true,
  },
})
