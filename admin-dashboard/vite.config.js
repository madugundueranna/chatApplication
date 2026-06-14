import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, if VITE_API_BASE_URL is left empty the app calls same-origin `/api`,
// and this proxy forwards those requests to the backend — so no CORS setup is
// needed locally. Set VITE_API_BASE_URL to hit a remote backend directly.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET || 'http://localhost:5000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  };
});
