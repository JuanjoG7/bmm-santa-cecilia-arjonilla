import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const html = [documentHtml, ...['app-bootstrap.js','app-workflows.js','theme-palette.js','marches-order-bulk.js'].map(name => fs.readFileSync(path.join(ROOT, 'assets/js', name), 'utf8'))].join('\n');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('versión actual y caché PWA alineadas con el parche publicado', () => {
  assert.equal(pkg.version, '1.13.1');
  assert.match(html, /const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(html, /version:'1\.8\.3'.*Corrección de acceso en producción/s);
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});

test('el editor muestra posición automática y la numeración no es editable', () => {
  assert.match(html, /data-march-order-label/);
  assert.match(html, /type="hidden" name="order" value=/);
  assert.match(html, /bmmRefreshMarchOrder/);
  assert.match(html, /data-action="move-march-up"/);
  assert.match(html, /data-action="move-march-down"/);
  const wrapperStart = html.indexOf('const bmmMarchRowBeforeV178 = marchRowHtml;');
  const wrapperEnd = html.indexOf('function bmmMarchRows()', wrapperStart);
  const activeWrapper = html.slice(wrapperStart, wrapperEnd);
  assert.ok(wrapperStart > -1 && wrapperEnd > wrapperStart);
  assert.match(activeWrapper, /type=\"hidden\" name=\"order\"/);
});

test('la selección rápida admite repeticiones de una misma marcha hasta diez veces', () => {
  assert.match(html, /data-quick-count data-march-id=/);
  assert.match(html, /for\(let n=0;n<qty;n\+\+\)marches\.push/);
  assert.match(html, /data-action="quick-add-march"/);
  assert.doesNotMatch(html, /const existing=new Set\(marches\.map\(p=>p\.marchId\)\);\[\.\.\.form\.querySelectorAll\('input\[name="quickMarchIds"\]:checked'\)\]/);
});

test('la edición múltiple conserva lo existente y añade repeticiones a todos los eventos seleccionados', () => {
  assert.match(html, /bmm-bulk-march-editor/);
  assert.match(html, /name="bmmBulkEventIds"/);
  assert.match(html, /name="bmmBulkMarchIds"/);
  assert.match(html, /data-bmm-bulk-count/);
  assert.match(html, /state\.events=state\.events\.map\(ev=>\{/);
  assert.match(html, /rows\.push\(\{id:uid\('perf'\),marchId:item\.marchId/);
  assert.match(html, /No se eliminará ni sustituirá ninguna marcha existente/);
});

test('el HTML carga los scripts externos en el orden compatible del legado', () => {
  const scriptTags = [...documentHtml.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*><\/script>/g)].map(m => ({ attrs: m[1], src: m[2] }));
  assert.deepEqual(scriptTags.map(x => x.src), [
    '/assets/js/app-bootstrap.js',
    '/assets/js/app-workflows.js',
    '/assets/js/theme-palette.js',
    '/assets/js/marches-order-bulk.js',
    '/assets/js/interface-quality.js'
  ]);
  assert.ok(scriptTags.every(x => !/\b(async|defer|type\s*=\s*["']module)/i.test(x.attrs)));
  assert.ok(!/<script\s*>/.test(documentHtml), 'No queda JavaScript de aplicación inline');
});

test('CSS base separado y capa responsive accesible están enlazados', () => {
  assert.match(documentHtml, /href="\/assets\/css\/app-base\.css"/);
  assert.match(documentHtml, /href="\/assets\/css\/phase3-accessibility\.css"/);
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/phase3-accessibility.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-width: 1080px|max-width: 1080px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 44px/);
});

test('el service worker precarga todos los módulos CSS y JavaScript nuevos', () => {
  for (const resource of [
    '/assets/css/app-base.css', '/assets/css/phase3-accessibility.css',
    '/assets/js/app-bootstrap.js', '/assets/js/app-workflows.js',
    '/assets/js/theme-palette.js', '/assets/js/marches-order-bulk.js'
  ]) assert.ok(sw.includes(resource), `Falta en APP_SHELL: ${resource}`);
});

test('todos los JavaScript externos tienen sintaxis válida', async () => {
  const { Script } = await import('node:vm');
  for (const file of [
    'assets/js/app-bootstrap.js', 'assets/js/app-workflows.js',
    'assets/js/theme-palette.js', 'assets/js/marches-order-bulk.js', 'sw.js'
  ]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.doesNotThrow(() => new Script(source, { filename: file }), file);
  }
});


test('los datos persistentes usan un Blob con nombre estable y migran sin borrar el legado', () => {
  const server = fs.readFileSync(path.join(ROOT, 'netlify/functions/state.mjs'), 'utf8');
  assert.match(server, /const DATA_STORE_NAME = 'bmm-santa-cecilia-data-v1'/);
  assert.match(server, /const LEGACY_STORE_NAME = 'bmm-santa-cecilia'/);
  assert.match(server, /getStore\(\{ name: DATA_STORE_NAME, region: DATA_STORE_REGION \}\)/);
  assert.match(server, /getStore\(\{ name: LEGACY_STORE_NAME, region: DATA_STORE_REGION \}\)/);
  assert.match(server, /onlyIfNew: true/);
  assert.match(server, /migratedFrom: LEGACY_STORE_NAME/);
  assert.match(server, /deliberately never deleted or modified/i);
});


test('el panel de diagnóstico técnico expone los códigos de fallo esperados', async () => {
  const fs = await import('node:fs');
  const js = fs.readFileSync(new URL('../assets/js/app-workflows.js', import.meta.url), 'utf8');
  assert.match(js, /Diagnóstico técnico/);
  assert.match(js, /BMM-LOCAL-BACKUP-FAILED/);
  assert.match(js, /BMM-STATE-HTTP-ERROR/);
  assert.match(js, /diagnostics-copy/);
});


test('fase 2 fija la región existente us-east-2 en ambos stores sin cambiar sus nombres', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../netlify/functions/state.mjs', import.meta.url), 'utf8');
  assert.match(source, /const DATA_STORE_REGION = 'us-east-2'/);
  assert.match(source, /getStore\(\{ name: DATA_STORE_NAME, region: DATA_STORE_REGION \}\)/);
  assert.match(source, /getStore\(\{ name: LEGACY_STORE_NAME, region: DATA_STORE_REGION \}\)/);
  assert.match(source, /const DATA_STORE_NAME = 'bmm-santa-cecilia-data-v1'/);
});


test('sincronización usa la versión de Blobs validada en Marvel y expone diagnóstico servidor', () => {
  assert.equal(pkg.dependencies['@netlify/blobs'], '10.7.13');
  assert.match(html, /syncHttpStatus=r\.status/);
  assert.match(html, /body\.detail/);
  const server = fs.readFileSync(path.join(ROOT, 'netlify/functions/state.mjs'), 'utf8');
  assert.match(server, /BMM pre-write backup failed/);
  assert.match(server, /attempts: backupAttempts/);
});
