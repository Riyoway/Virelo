import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('./web', import.meta.url));
const outDir = fileURLToPath(new URL('./dist/web', import.meta.url));

export default defineConfig({
  root: webRoot,
  plugins: [react(), tailwindcss()],
  build: {
    outDir,
    emptyOutDir: false,
    sourcemap: false,
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@heroui')) return 'heroui';
          if (id.includes('node_modules/@tanstack')) return 'tanstack';
          if (id.includes('node_modules/@phosphor-icons')) return 'icons';
        }
      }
    }
  }
});
