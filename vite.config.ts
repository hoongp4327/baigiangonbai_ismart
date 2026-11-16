import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Hai trang: index.html (học sinh) và admin.html (giáo viên).
// base './' để thư mục dist chạy được ở bất kỳ đường dẫn nào trên máy chủ.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { index: resolve(import.meta.dirname, 'index.html'), admin: resolve(import.meta.dirname, 'admin.html') },
    },
  },
});
