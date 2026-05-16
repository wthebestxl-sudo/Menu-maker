import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'image-proxy',
        configureServer(server) {
          server.middlewares.use('/api/proxy-image', async (req, res) => {
            const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
            const imageUrl = urlParams.get('url');

            if (!imageUrl || !imageUrl.includes('supabase.co')) {
              res.statusCode = 400;
              res.end('Bad request');
              return;
            }

            try {
              const response = await fetch(imageUrl);
              const contentType = response.headers.get('content-type') || 'image/jpeg';
              const buffer = await response.arrayBuffer();

              res.setHeader('Content-Type', contentType);
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.statusCode = 200;
              res.end(Buffer.from(buffer));
            } catch (e) {
              res.statusCode = 500;
              res.end('Proxy error');
            }
          });
        },
      },
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
