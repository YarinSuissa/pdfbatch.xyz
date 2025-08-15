import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Determine base path based on deployment target
const getBasePath = '/'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: getBasePath(),
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // drops all console calls
        drop_debugger: true
      },
      format: { comments: false }
    }
  }
});


// hi!!!