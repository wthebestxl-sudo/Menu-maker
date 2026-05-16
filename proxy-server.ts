import express from 'express';
import { createServer } from 'http';

const app = express();

// Image proxy endpoint for local development
app.get('/api/proxy-image', async (req, res) => {
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  if (!url.includes('supabase.co')) {
    return res.status(403).json({ error: 'Only Supabase URLs are allowed' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3001;
createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Image proxy server running at http://0.0.0.0:${PORT}`);
});
