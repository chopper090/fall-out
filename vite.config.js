import { defineConfig } from 'vite';

export default defineConfig({
  // percorsi relativi: la build funziona anche in una sottocartella, come su GitHub Pages
  base: './',
  server: {
    // host attivo: il server è raggiungibile dal telefono sulla stessa Wi-Fi
    host: true,
    port: 5173,
    strictPort: true,
  },
});
