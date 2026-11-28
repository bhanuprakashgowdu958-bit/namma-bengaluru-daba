import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import spreadHandler from './api/spread.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-spread-glb-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/spread')) {
            void spreadHandler(req, res);
            return;
          }
          next();
        });
      }
    }
  ],
  server: {
    host: true,
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-model-viewer': ['@google/model-viewer']
        }
      }
    }
  }
});
