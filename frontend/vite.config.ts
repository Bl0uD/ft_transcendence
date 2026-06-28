import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // Force Vite à écouter sur 0.0.0.0 (nécessaire pour Docker)
    strictPort: true,
    // port: 5173, // Décommente cette ligne si ton Caddyfile s'attend à un autre port que le 5173 par défaut
  }
})