import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/ping': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/docs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/api/v1/docs': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['axios'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separate large dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['@headlessui/react', '@heroicons/react', 'lucide-react'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-raw', 'rehype-sanitize', 'react-syntax-highlighter'],
          'vendor-utils': ['axios', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Increase chunk size warning limit since we're now splitting intentionally
    chunkSizeWarningLimit: 1000,
  },
})
