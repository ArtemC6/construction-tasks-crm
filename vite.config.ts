import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — сборка работает из любой папки, в том числе на GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: './',
});
