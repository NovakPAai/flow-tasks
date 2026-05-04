import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3101',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: vendor hash changes only when dependencies change,
        // not on every app code change — keeps browser cache efficient after deploys.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd'],
        },
      },
    },
  },
});
