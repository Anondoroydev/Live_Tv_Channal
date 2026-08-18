import type { VercelRequest, VercelResponse } from '@vercel/node';

// A lightweight proxy for /api/* endpoints. If BACKEND_URL or APP_BACKEND_URL
// environment variable is set to the backend service URL (e.g. Cloud Run),
// this function will forward requests to that backend. Otherwise it returns
// 503 Service Unavailable so clients get a clear error instead of 405.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const backend = process.env.BACKEND_URL || process.env.APP_BACKEND_URL || process.env.APP_URL;
    if (!backend) {
      return res.status(503).json({ error: 'No backend configured. Set BACKEND_URL/APP_BACKEND_URL environment variable to your backend URL.' });
    }

    // Build target URL by replacing the /api prefix
    const incomingPath = (req.url || '').replace(/^\/api/, '');
    const targetUrl = new URL(incomingPath || '/', backend).href;

    const headers: Record<string, string> = {};
    // Forward most headers except host
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      if (k.toLowerCase() === 'host') continue;
      // Vercel request headers may be string|string[]; normalize to string
      headers[k] = Array.isArray(v) ? v.join(',') : String(v);
    }

    // Ensure content-type forwarded when body present
    if (!headers['content-type'] && req.body) {
      headers['content-type'] = 'application/json';
    }

    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : JSON.stringify(req.body),
    });

    // Forward status and headers
    res.status(fetchRes.status);
    fetchRes.headers.forEach((value, key) => {
      // Skip hop-by-hop headers
      if (['transfer-encoding', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'trailer', 'upgrade'].includes(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    const buffer = await fetchRes.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    console.error('[api proxy] error:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
