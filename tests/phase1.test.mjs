import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const source = fs.readFileSync(path.join(ROOT, 'netlify/functions/state.mjs'), 'utf8');
const authSource = fs.readFileSync(path.join(ROOT, 'netlify/functions/authenticate.mjs'), 'utf8');
const authExecutable = authSource.replace(/^import crypto from 'node:crypto';\r?\n/m, '').replace('export default async (request) => {', 'return async (request) => {');
const authHandler = new Function('crypto', 'process', authExecutable)(crypto, process);
const documentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const html = [documentHtml, ...['app-bootstrap.js','app-workflows.js','theme-palette.js','marches-order-bulk.js'].map(name => fs.readFileSync(path.join(ROOT, 'assets/js', name), 'utf8'))].join('\n');

let entries;
let etagCounter;
let beforeStateWrite;
function createStore() {
  return {
    async getWithMetadata(key) {
      const entry = entries.get(key);
      return entry ? { data: structuredClone(entry.value), etag: entry.etag, metadata: entry.metadata || {} } : null;
    },
    async setJSON(key, value, options = {}) {
      if (key === 'state.json' && beforeStateWrite) {
        const hook = beforeStateWrite;
        beforeStateWrite = null;
        await hook();
      }
      const current = entries.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
      const etag = `"mock-${++etagCounter}"`;
      entries.set(key, { value: structuredClone(value), etag, metadata: options.metadata || {} });
      return { modified: true, etag };
    },
    async list({ prefix = '' } = {}) {
      return { blobs: [...entries.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, entry]) => ({ key, etag: entry.etag })) };
    },
    async delete(key) { entries.delete(key); }
  };
}
const store = createStore();
const fakeGetStore = () => store;
const executable = source
  .replace(/^import crypto from 'node:crypto';\r?\n/m, '')
  .replace(/^import \{ getStore \} from '@netlify\/blobs';\r?\n/m, '')
  .replace('export default async (request) => {', 'return async (request) => {');
const makeHandler = new Function('crypto', 'getStore', 'process', executable);
const handler = makeHandler(crypto, fakeGetStore, process);
const SECRET = 'phase1-test-secret-not-production';
process.env.SESSION_SECRET = SECRET;
process.env.CONTEXT = 'production';
process.env.URL = 'https://bmm.test';
function cookie() {
  const payload = Buffer.from(JSON.stringify({ user: 'phase1-test', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `sc_session=${payload}.${signature}`;
}
function req(method, route = '/', body, headers = {}) {
  const h = new Headers({ cookie: cookie(), ...headers });
  return new Request(`https://bmm.test/.netlify/functions/state${route}`, {
    method,
    headers: h,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
  });
}
async function json(response) { return response.json(); }
function validState(extra = {}) {
  return { version: 2, repertoire: [{ id: 'm-1', name: 'Marcha de prueba', author: 'Autor' }], events: [{ id: 'e-1', date: '2026-10-12', name: 'Actuación de prueba', marches: [] }], categories: ['Procesión'], ...extra };
}
function reset() { entries = new Map(); etagCounter = 0; beforeStateWrite = null; }

test.beforeEach(reset);

test('bloquea lectura y escritura del Blob fuera del contexto production', async () => {
  const originalContext = process.env.CONTEXT;
  try {
    process.env.CONTEXT = 'deploy-preview';
    const get = await handler(req('GET'));
    assert.equal(get.status, 403);
    assert.match((await json(get)).error, /despliegue.*permiso/i);
    const post = await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null }));
    assert.equal(post.status, 403);
    assert.equal(entries.size, 0, 'la preview no debe crear ni leer/escribir estado ni copias');
  } finally {
    process.env.CONTEXT = originalContext;
  }
});


test('permite el dominio canónico de producción aunque CONTEXT no esté disponible en Functions runtime', async () => {
  const originalContext = process.env.CONTEXT;
  try {
    delete process.env.CONTEXT;
    const production = await handler(req('GET'));
    assert.equal(production.status, 200);
    const preview = await handler(new Request('https://bmm-preview.test/.netlify/functions/state', {
      method: 'GET', headers: { cookie: cookie() }
    }));
    assert.equal(preview.status, 403);
  } finally {
    process.env.CONTEXT = originalContext;
  }
});

test('bloquea también la autenticación en Deploy Preview', async () => {
  const originalContext = process.env.CONTEXT;
  try {
    process.env.CONTEXT = 'deploy-preview';
    const response = await authHandler(new Request('https://bmm-preview.test/.netlify/functions/authenticate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'cualquier-clave' })
    }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('set-cookie'), null, 'una preview no debe emitir cookies de sesión');
    assert.match((await json(response)).error, /solo está habilitado en el despliegue de producción/i);
  } finally {
    process.env.CONTEXT = originalContext;
  }
});

test('GET devuelve null y ETag null cuando todavía no existe estado', async () => {
  const response = await handler(req('GET'));
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.state, null);
  assert.equal(body.etag, null);
});

test('primer guardado crea el estado con escritura create-only', async () => {
  const response = await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null }));
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.saved, true);
  assert.ok(body.etag);
  assert.ok(entries.has('state.json'));
  assert.equal([...entries.keys()].filter(key => key.startsWith('backups/')).length, 0);
});

test('guardar el mismo contenido no cambia ETag ni crea una copia redundante', async () => {
  const first = await json(await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null })));
  const current = (await store.getWithMetadata('state.json')).data;
  const response = await handler(req('POST', '/', { state: current, expectedCloudEtag: first.etag }));
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.unchanged, true);
  assert.equal(body.etag, first.etag);
  assert.equal([...entries.keys()].filter(key => key.startsWith('backups/')).length, 0);
});

test('un guardado solo con metadatos de nube distintos no crea una nueva versión', async () => {
  const first = await json(await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null })));
  const current = (await store.getWithMetadata('state.json')).data;
  const metadataOnly = { ...current, cloudUpdatedAt: '2000-01-01T00:00:00.000Z', cloudUpdatedBy: 'otro-dispositivo' };
  const response = await handler(req('POST', '/', { state: metadataOnly, expectedCloudEtag: first.etag }));
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.unchanged, true);
  assert.equal(body.etag, first.etag);
  assert.equal([...entries.keys()].filter(key => key.startsWith('backups/')).length, 0);
});

test('un cambio real crea una copia previa recuperable antes de reemplazar el estado', async () => {
  const first = await json(await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null })));
  const changed = validState({ events: [{ id: 'e-1', date: '2026-10-12', name: 'Nombre nuevo', marches: [] }] });
  const response = await handler(req('POST', '/', { state: changed, expectedCloudEtag: first.etag }));
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.ok(body.etag && body.etag !== first.etag);
  const backupKeys = [...entries.keys()].filter(key => key.startsWith('backups/'));
  assert.equal(backupKeys.length, 1);
  assert.equal((await store.getWithMetadata(backupKeys[0])).data.events[0].name, 'Actuación de prueba');
});

test('un ETag obsoleto devuelve conflicto sin sobrescribir el estado actual', async () => {
  const first = await json(await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null })));
  const latest = validState({ events: [{ id: 'e-1', date: '2026-10-12', name: 'Versión remota', marches: [] }] });
  await handler(req('POST', '/', { state: latest, expectedCloudEtag: first.etag }));
  const stale = validState({ events: [{ id: 'e-1', date: '2026-10-12', name: 'Versión antigua', marches: [] }] });
  const response = await handler(req('POST', '/', { state: stale, expectedCloudEtag: first.etag }));
  const body = await json(response);
  assert.equal(response.status, 409);
  assert.equal(body.conflict, true);
  assert.equal(body.state.events[0].name, 'Versión remota');
});

test('si la nube cambia entre lectura y escritura, la escritura condicional evita pisarla', async () => {
  const first = await json(await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null })));
  const incoming = validState({ events: [{ id: 'e-1', date: '2026-10-12', name: 'Intento cliente', marches: [] }] });
  beforeStateWrite = async () => {
    entries.set('state.json', { value: { ...validState({ events: [{ id: 'e-1', date: '2026-10-12', name: 'Escritura de otro dispositivo', marches: [] }] }), cloudUpdatedAt: new Date().toISOString() }, etag: '"external-race"', metadata: {} });
  };
  const response = await handler(req('POST', '/', { state: incoming, expectedCloudEtag: first.etag }));
  const body = await json(response);
  assert.equal(response.status, 409);
  assert.equal(body.state.events[0].name, 'Escritura de otro dispositivo');
  assert.equal((await store.getWithMetadata('state.json')).data.events[0].name, 'Escritura de otro dispositivo');
});

test('permite listar y descargar copias anteriores sin modificar el estado vigente', async () => {
  const first = await json(await handler(req('POST', '/', { state: validState(), expectedCloudEtag: null })));
  const changed = validState({ events: [{ id: 'e-1', date: '2026-10-12', name: 'Nueva versión', marches: [] }] });
  await handler(req('POST', '/', { state: changed, expectedCloudEtag: first.etag }));
  const listResponse = await handler(req('GET', '?backups=1'));
  const listBody = await json(listResponse);
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.backups.length, 1);
  const backupKey = listBody.backups[0].key;
  const backupResponse = await handler(req('GET', '?backup=' + encodeURIComponent(backupKey)));
  const backupBody = await json(backupResponse);
  assert.equal(backupResponse.status, 200);
  assert.equal(backupBody.state.events[0].name, 'Actuación de prueba');
  assert.equal(backupBody.currentEtag, (await store.getWithMetadata('state.json')).etag);
  const current = (await store.getWithMetadata('state.json')).data;
  assert.equal(current.events[0].name, 'Nueva versión');
});

test('rechaza identificadores de copia no válidos', async () => {
  const response = await handler(req('GET', '?backup=state.json'));
  assert.equal(response.status, 400);
});

test('rechaza JSON inválido, estructura inválida y payload excesivo', async () => {
  const malformed = await handler(req('POST', '/', '{not-json', { 'content-type': 'application/json' }));
  assert.equal(malformed.status, 400);
  const invalid = await handler(req('POST', '/', { state: { events: 'no-array', repertoire: [] } }));
  assert.equal(invalid.status, 400);
  const excessiveBody = JSON.stringify({ state: { events: [], repertoire: [], note: 'x'.repeat(4 * 1024 * 1024) } });
  const excessive = await handler(req('POST', '/', excessiveBody, { 'content-type': 'application/json' }));
  assert.equal(excessive.status, 413);
});

test('los cambios de tema y las cargas normales son de solo lectura; los eventos vencidos se sincronizan condicionalmente', () => {
  const themeStart = html.indexOf("if(!input||input.name!=='bmmThemeMode')return;");
  const themeEnd = html.indexOf("window.matchMedia?.('(prefers-color-scheme: dark)')", themeStart);
  const themeBlock = html.slice(themeStart, themeEnd);
  assert.ok(themeStart > -1 && themeEnd > themeStart);
  assert.doesNotMatch(themeBlock, /bmmScheduleCloudSave|bmmAddAudit\(|STORE_KEY/);
  assert.match(html, /Guardado cancelado para proteger los datos anteriores/);
  assert.match(html, /no se ha iniciado la sincronización/);
  const floatingSaveGuardStart = html.lastIndexOf('The floating/manual save has its own legacy handler');
  const floatingSaveGuardEnd = html.indexOf('New actions are handled directly', floatingSaveGuardStart);
  const floatingSaveGuard = html.slice(floatingSaveGuardStart, floatingSaveGuardEnd);
  assert.ok(floatingSaveGuardStart > -1 && floatingSaveGuardEnd > floatingSaveGuardStart);
  assert.match(floatingSaveGuard, /stopImmediatePropagation/);
  assert.match(floatingSaveGuard, /bmmSnapshotPreviousLocalIfChanged/);
  assert.match(floatingSaveGuard, /if\(bmmFormDirty\)/);
  assert.match(floatingSaveGuard, /sincronización se ha cancelado/);
  assert.doesNotMatch(html, /if\(!loaded\)\{bmmAuthenticated=true;bmmCloudMode=true;await bmmSyncNow\(\);\}/);
  assert.match(html, /const bmmSaveBeforePhase1Final=save;/);
  assert.match(html, /if\(r!==false\)bmmScheduleCloudSave\(\)/);
  const loadStart = html.lastIndexOf('bmmLoadCloudFromSettings=async function(){');
  const loadEnd = html.indexOf('\n  // Resolve a conflict by adopting the exact remote version', loadStart);
  const loadBlock = html.slice(loadStart, loadEnd);
  assert.ok(loadStart > -1 && loadEnd > loadStart);
  assert.match(loadBlock, /if\(remoteAutoCompletionCount>0\)/);
  assert.match(loadBlock, /const synced=await bmmSyncNow\(\)/);
  assert.match(loadBlock, /Copia de la nube cargada\. La nube no se ha modificado/);
  assert.match(loadBlock, /bmmCloudEtag=body\.etag\|\|null/);
});


test('la comparación de cargas ignora metadatos de nube y normaliza el orden de las claves', () => {
  const compareStart = html.indexOf('function bmmCanonicalPayload(value,isRoot=true)');
  const compareEnd = html.indexOf('// Single-flight cloud write', compareStart);
  const compareBlock = html.slice(compareStart, compareEnd);
  assert.ok(compareStart > -1 && compareEnd > compareStart);
  assert.match(compareBlock, /Object\.keys\(value\).*\.sort\(\)/);
  assert.match(compareBlock, /cloudUpdatedAt.*cloudUpdatedBy/);
  assert.match(html, /if\(bmmHasUnresolvedLocalRecovery\(\)\)\{\s*\/\/ Even if a separate recovery record was stored/);
  assert.doesNotMatch(html.slice(html.indexOf('function bmmCaptureLocalRecovery'), html.indexOf('let state=loadState()')), /removeItem\(BMM_LOCAL_BACKUPS_KEY\)/);
});


test('el historial visible de versiones no duplica entradas y conserva 1.7.0 y 1.7.4', () => {
  const start = html.indexOf('const BMM_VERSION_HISTORY = [');
  const end = html.indexOf('const BMM_VERSION_SEEN_KEY', start);
  const history = html.slice(start, end);
  const versions = [...history.matchAll(/\{version:'([^']+)'/g)].map(match => match[1]);
  assert.ok(start > -1 && end > start);
  assert.equal(new Set(versions).size, versions.length);
  assert.ok(versions.includes('1.7.0'));
  assert.ok(versions.includes('1.7.4'));
});

test('migra el estado antiguo al Blob estable sin borrar ni modificar el original', async () => {
  const makeNamedStore = (map) => ({
    async getWithMetadata(key) {
      const entry = map.get(key);
      return entry ? { data: structuredClone(entry.value), etag: entry.etag, metadata: entry.metadata || {} } : null;
    },
    async setJSON(key, value, options = {}) {
      const current = map.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
      const etag = `"named-${map.size + 1}-${key}"`;
      map.set(key, { value: structuredClone(value), etag, metadata: options.metadata || {} });
      return { modified: true, etag };
    },
    async list({ prefix = '' } = {}) {
      return { blobs: [...map.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, entry]) => ({ key, etag: entry.etag })) };
    },
    async delete(key) { map.delete(key); }
  });
  const primaryEntries = new Map();
  const legacyState = validState({ events: [{ id: 'legacy-event', date: '2026-10-12', name: 'Datos anteriores', marches: [] }] });
  const legacyEntries = new Map([['state.json', { value: structuredClone(legacyState), etag: '"legacy-original"', metadata: { source: 'previous' } }]]);
  const namedStores = new Map([
    ['bmm-santa-cecilia-data-v1', makeNamedStore(primaryEntries)],
    ['bmm-santa-cecilia', makeNamedStore(legacyEntries)]
  ]);
  const namedHandler = makeHandler(crypto, (nameOrOptions) => namedStores.get(typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions.name), process);
  const response = await namedHandler(req('GET'));
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.state.events[0].name, 'Datos anteriores');
  assert.equal(primaryEntries.get('state.json').value.events[0].name, 'Datos anteriores');
  assert.equal(legacyEntries.get('state.json').etag, '"legacy-original"');
  assert.equal(legacyEntries.get('state.json').value.events[0].name, 'Datos anteriores');
});
