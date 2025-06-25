import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Update the backend port if your backend runs on a different port (commonly 5000)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000', // Ensure this matches your backend port
    },
  },
});