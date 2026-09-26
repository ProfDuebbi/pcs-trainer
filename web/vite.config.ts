import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 5183,
    // Alles unter /api geht an den lokalen Helfer, der die Dateiarbeit macht.
    proxy: { '/api': 'http://127.0.0.1:8791' },
  },
});
