import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Only allow Supabase storage URLs for security
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
}
