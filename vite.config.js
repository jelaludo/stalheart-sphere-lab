import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets work both on localhost and under the GitHub Pages project path.
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', orbital: 'orbital.html' }
    }
  }
});
