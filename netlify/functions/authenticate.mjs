import crypto from 'node:crypto';

// Netlify exposes URL to Functions at runtime, but CONTEXT is a build-time
// variable and may be undefined in a Function. Compare the incoming host with
// the site's canonical production URL instead; preview URLs have a different host.
function isProductionRequest(request) {
  const context = process.env.CONTEXT;
  if (context && context !== 'production') return false;
  const canonicalUrl = process.env.URL;
  if (!canonicalUrl) return false; // fail closed if production identity is unknown
  try {
    const requestHost = new URL(request.url).host.toLowerCase();
    const productionHost = new URL(canonicalUrl).host.toLowerCase();
    return requestHost === productionHost && (!context || context === 'production');
  } catch {
    return false;
  }
}

export default async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  // Keep preview credentials and sessions away from the production data path.
  if (!isProductionRequest(request)) {
    return Response.json({ authenticated: false, error: 'El acceso compartido solo está habilitado en el despliegue de producción. Usa un sitio de pruebas independiente para validar cambios.' }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
  const expected = process.env.APP_ACCESS_TOKEN;
  const sessionSecret = process.env.SESSION_SECRET;
  if (!expected || !sessionSecret) return Response.json({ authenticated: false, error: 'Authentication is not configured.' }, { status: 503 });
  let payload;
  try { payload = await request.json(); } catch { return Response.json({ authenticated: false }, { status: 400 }); }
  const supplied = typeof payload?.token === 'string' ? payload.token : '';
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) return Response.json({ authenticated: false }, { status: 401 });
  const now = Math.floor(Date.now() / 1000);
  const remember = payload?.remember === true;
  const maxAge = remember ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
  const user = String(payload?.username || 'Usuario').slice(0, 60);
  const encoded = Buffer.from(JSON.stringify({ user, iat: now, exp: now + maxAge })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(encoded).digest('base64url');
  return new Response(JSON.stringify({ authenticated: true, user, expiresIn: maxAge, remembered: remember }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': `sc_session=${encoded}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
    }
  });
};
