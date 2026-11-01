import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/site', emptyOutDir: true, target: 'es2020', cssCodeSplit: true, sourcemap: false },
});
