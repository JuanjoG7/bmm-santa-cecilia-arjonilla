import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

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

// Durable data is kept in a named Blobs store, never in the deploy bundle.
// Keep this name stable across application releases. The legacy store is read-only
// during migration so existing installations keep their data.
const DATA_STORE_NAME = 'bmm-santa-cecilia-data-v1';
const LEGACY_STORE_NAME = 'bmm-santa-cecilia';
// Phase 2: pin the existing implicit default explicitly. This MUST remain
// us-east-2 until a separately backed-up and verified region migration runs.
const DATA_STORE_REGION = 'us-east-2';
const MAX_STATE_BYTES = 4 * 1024 * 1024;
const MAX_EVENTS = 20000;
const MAX_REPERTOIRE = 20000;
const MAX_MEMBERS = 10000;
const MAX_TOTAL_PERFORMANCES = 100000;

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateState(state) {
  if (!isRecord(state) || !Array.isArray(state.events) || !Array.isArray(state.repertoire)) return false;
  if (state.events.length > MAX_EVENTS || state.repertoire.length > MAX_REPERTOIRE) return false;
  for (const event of state.events) {
    if (!isRecord(event)) return false;
    if (event.marches !== undefined && !Array.isArray(event.marches)) return false;
  }
  for (const march of state.repertoire) if (!isRecord(march)) return false;
  for (const field of ['categories', 'groupsCatalog', 'members', 'auditLog']) {
    if (state[field] !== undefined && !Array.isArray(state[field])) return false;
  }
  if (Array.isArray(state.members) && state.members.length > MAX_MEMBERS) return false;
  let totalPerformances = 0;
  for (const event of state.events) {
    const performances = Array.isArray(event.marches) ? event.marches : [];
    totalPerformances += performances.length;
    if (totalPerformances > MAX_TOTAL_PERFORMANCES) return false;
    for (const performance of performances) if (!isRecord(performance)) return false;
  }
  return true;
}

function sessionFrom(request) {
  const cookie = request.headers.get('cookie') || '';
  const raw = cookie.split(';').map(x => x.trim()).find(x => x.startsWith('sc_session='))?.slice('sc_session='.length);
  if (!raw) return null;
  const i = raw.lastIndexOf('.');
  if (i < 1) return null;
  const payload = raw.slice(0, i), signature = raw.slice(i + 1), secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

function canonical(value, isRoot = false) {
  if (Array.isArray(value)) return '[' + value.map(item => canonical(item, false)).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).filter(key => !(isRoot && ['cloudUpdatedAt', 'cloudUpdatedBy'].includes(key)))
      .sort().map(key => JSON.stringify(key) + ':' + canonical(value[key], false)).join(',') + '}';
  }
  return JSON.stringify(value);
}

function createdAtFromBackupKey(key) {
  const match = /^backups\/(\d{13})-[a-f0-9]+\.json$/.exec(String(key || ''));
  return match ? new Date(Number(match[1])).toISOString() : null;
}

async function listBackups(store) {
  const listed = await store.list({ prefix: 'backups/' });
  return (listed?.blobs || [])
    .filter(item => /^backups\/\d{13}-[a-f0-9]+\.json$/.test(item.key))
    .sort((a, b) => b.key.localeCompare(a.key))
    .slice(0, 8)
    .map(item => ({ key: item.key, etag: item.etag || null, createdAt: createdAtFromBackupKey(item.key) }));
}

async function pruneBackups(store) {
  try {
    const listed = await store.list({ prefix: 'backups/' });
    const all = (listed?.blobs || []).filter(item => /^backups\/\d{13}-[a-f0-9]+\.json$/.test(item.key)).sort((a, b) => b.key.localeCompare(a.key));
    await Promise.all(all.slice(8).map(item => store.delete(item.key).catch(() => undefined)));
  } catch (_) {
    // Retention cleanup is best-effort. A committed state write must not be reported as failed.
  }
}

async function getPersistentStore() {
  const primary = getStore({ name: DATA_STORE_NAME, region: DATA_STORE_REGION });
  const current = await primary.getWithMetadata('state.json', { type: 'json', consistency: 'strong' });
  if (current) return primary;

  // One-time, non-destructive migration from the previous store name. The old
  // store is deliberately never deleted or modified, so rollback remains possible.
  const legacy = getStore({ name: LEGACY_STORE_NAME, region: DATA_STORE_REGION });
  const oldState = await legacy.getWithMetadata('state.json', { type: 'json', consistency: 'strong' });
  if (oldState?.data && validateState(oldState.data)) {
    await primary.setJSON('state.json', oldState.data, {
      onlyIfNew: true,
      metadata: { migratedFrom: LEGACY_STORE_NAME, migratedAt: new Date().toISOString(), purpose: 'persistent-app-data' }
    });
    // A concurrent request may have won the create-only write. Always return
    // the primary store and let the caller read its authoritative ETag.
  }
  return primary;
}

export default async (request) => {
  if (!['GET', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  // Phase 1 protection: never expose the production Blob from branch deploys,
  // Deploy Previews and non-canonical hosts are blocked.
  if (!isProductionRequest(request)) {
    return Response.json({ error: 'Este despliegue no tiene permiso para acceder al almacenamiento compartido de producción. Usa el sitio de producción o un sitio de pruebas con su propio almacén.' }, {
      status: 403,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
  const session = sessionFrom(request);
  if (!session) return Response.json({ authenticated: false, error: 'Sesión no válida o caducada.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const store = await getPersistentStore();
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.searchParams.get('backups') === '1') {
        return Response.json({ authenticated: true, backups: await listBackups(store) }, { headers });
      }
      const requestedBackup = url.searchParams.get('backup');
      if (requestedBackup) {
        if (!/^backups\/\d{13}-[a-f0-9]+\.json$/.test(requestedBackup)) {
          return Response.json({ error: 'Identificador de copia no válido.' }, { status: 400, headers });
        }
        const backup = await store.getWithMetadata(requestedBackup, { type: 'json', consistency: 'strong' });
        if (!backup?.data || !Array.isArray(backup.data.events) || !Array.isArray(backup.data.repertoire)) {
          return Response.json({ error: 'La copia solicitada no existe o no contiene datos válidos.' }, { status: 404, headers });
        }
        const currentEntry = await store.getWithMetadata('state.json', { type: 'json', consistency: 'strong' });
        return Response.json({ authenticated: true, state: backup.data, currentEtag: currentEntry?.etag || null, backup: { key: requestedBackup, etag: backup.etag || null, createdAt: createdAtFromBackupKey(requestedBackup) } }, { headers });
      }
      const entry = await store.getWithMetadata('state.json', { type: 'json', consistency: 'strong' });
      return Response.json({ authenticated: true, user: session.user, state: entry?.data || null, etag: entry?.etag || null }, { headers });
    }

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_STATE_BYTES) {
      return Response.json({ error: 'La copia supera el tamaño máximo permitido (4 MB). Exporta o reduce el archivo antes de sincronizar.' }, { status: 413, headers });
    }
    let rawBody;
    try { rawBody = await request.text(); }
    catch { return Response.json({ error: 'No se ha podido leer el cuerpo de la petición.' }, { status: 400, headers }); }
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_STATE_BYTES) {
      return Response.json({ error: 'La copia supera el tamaño máximo permitido (4 MB). Exporta o reduce el archivo antes de sincronizar.' }, { status: 413, headers });
    }
    let body;
    try { body = JSON.parse(rawBody); }
    catch { return Response.json({ error: 'El contenido enviado no es JSON válido.' }, { status: 400, headers }); }
    if (!validateState(body?.state)) {
      return Response.json({ error: 'La estructura de datos no es válida o supera los límites de seguridad.' }, { status: 400, headers });
    }

    // Read current version, verify it, then conditionally commit against exactly that ETag.
    const currentEntry = await store.getWithMetadata('state.json', { type: 'json', consistency: 'strong' });
    const current = currentEntry?.data || null;
    const currentEtag = currentEntry?.etag || null;
    const expectedEtag = typeof body.expectedCloudEtag === 'string' && body.expectedCloudEtag ? body.expectedCloudEtag : null;
    const expectedStamp = body.expectedCloudUpdatedAt ?? body.state.cloudUpdatedAt ?? null;
    const force = body.force === true;

    let mismatch = false;
    if (currentEntry) {
      if (expectedEtag) mismatch = expectedEtag !== currentEtag;
      else mismatch = !force && String(expectedStamp || '') !== String(current?.cloudUpdatedAt || '');
    } else {
      mismatch = !force && (!!expectedEtag || !!expectedStamp);
    }
    if (mismatch) {
      return Response.json({ conflict: true, error: 'Existe una versión más reciente en la nube.', state: current, etag: currentEtag }, { status: 409, headers });
    }

    // Avoid changing the cloud revision, ETag or backup history for a no-op save.
    if (currentEntry && canonical(current, true) === canonical(body.state, true)) {
      return Response.json({ saved: true, unchanged: true, savedAt: current.cloudUpdatedAt || null, etag: currentEtag }, { headers });
    }

    // Store a recoverable pre-write snapshot before replacing a current cloud version.
    // If the snapshot cannot be persisted, abort the overwrite rather than destroying
    // the only known current version without a recovery point.
    if (currentEntry) {
      // Resilient pre-write recovery: retry transient Blob errors and verify the
      // stored snapshot by reading it back. A successful API response alone is
      // not enough to authorize replacing the current cloud state.
      let backupSaved = false;
      let backupFailure = 'No se pudo confirmar la copia previa.';
      let backupAttempts = 0;
      const backupDelays = [0, 500, 1200];
      for (let attempt = 0; attempt < backupDelays.length && !backupSaved; attempt++) {
        backupAttempts = attempt + 1;
        if (backupDelays[attempt]) await new Promise(resolve => setTimeout(resolve, backupDelays[attempt]));
        const backupKey = `backups/${String(Date.now()).padStart(13, '0')}-${crypto.randomBytes(6).toString('hex')}.json`;
        try {
          await store.setJSON(backupKey, current, {
            metadata: { createdAt: new Date().toISOString(), createdBy: String(session.user || 'BMM'), type: 'pre-write-recovery' }
          });
          const confirmed = await store.getWithMetadata(backupKey, { type: 'json', consistency: 'strong' });
          if (confirmed?.data && validateState(confirmed.data) && canonical(confirmed.data) === canonical(current)) {
            backupSaved = true;
          } else {
            backupFailure = 'La copia previa se escribió, pero la verificación de lectura no coincide.';
          }
        } catch (backupError) {
          // Keep only a safe, short error description; never expose credentials.
          backupFailure = String(backupError?.message || backupError || 'Error de Netlify Blobs').slice(0, 180);
        }
      }
      if (!backupSaved) {
        console.error('BMM pre-write backup failed', { store: DATA_STORE_NAME, region: DATA_STORE_REGION, attempts: backupAttempts, reason: backupFailure });
        return Response.json({
          error: 'No se pudo confirmar la copia de seguridad previa. El guardado se ha cancelado y los datos de la nube no se han reemplazado.',
          code: 'BMM-BACKUP-PREWRITE',
          operation: 'backup-before-write',
          retryable: true,
          attempts: backupAttempts,
          detail: backupFailure
        }, { status: 503, headers });
      }
    }

    const incoming = { ...body.state, cloudUpdatedAt: new Date().toISOString(), cloudUpdatedBy: String(session.user || 'BMM') };
    const conditional = currentEntry ? { onlyIfMatch: currentEtag } : { onlyIfNew: true };
    const result = await store.setJSON('state.json', incoming, conditional);
    if (result?.modified === false) {
      const latest = await store.getWithMetadata('state.json', { type: 'json', consistency: 'strong' });
      return Response.json({ conflict: true, error: 'La nube cambió durante el guardado. No se ha sobrescrito la versión nueva.', state: latest?.data || null, etag: latest?.etag || null }, { status: 409, headers });
    }
    if (result?.modified !== true || typeof result.etag !== 'string' || !result.etag) {
      throw new Error('No se ha podido confirmar el ETag del guardado condicional.');
    }
    await pruneBackups(store);
    return Response.json({ saved: true, savedAt: incoming.cloudUpdatedAt, etag: result.etag }, { headers });
  } catch (error) {
    const message = String(error?.message || error || 'Error desconocido');
    console.error('BMM state handler failed', { method: request.method, store: DATA_STORE_NAME, region: DATA_STORE_REGION, name: String(error?.name || 'Error'), message: message.slice(0, 240) });
    if (message.includes('ETag') || message.includes('etiqueta') || message.includes('condicional')) {
      return Response.json({ error: 'No se ha podido confirmar la escritura en Netlify Blobs. Comprueba de nuevo el estado de la nube antes de reintentar.', code: 'BMM-BLOB-CONFIRM', retryable: true }, { status: 503, headers });
    }
    return Response.json({
      error: 'No se ha podido acceder al almacenamiento en la nube.',
      code: 'BMM-BLOB-ACCESS',
      operation: request.method === 'POST' ? 'cloud-write' : 'cloud-read',
      retryable: true,
      detail: process.env.NODE_ENV === 'development' ? message.slice(0, 240) : undefined
    }, { status: 503, headers });
  }
};
