import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'assets/js/app-bootstrap.js'), 'utf8');
const workflows = fs.readFileSync(path.join(ROOT, 'assets/js/app-workflows.js'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
test('la cabecera móvil queda fija y el contenido reserva su altura', () => {
  assert.match(html, /bmm-responsive-acts-v188/);
  assert.match(html, /position:fixed!important; inset:0 0 auto 0!important/);
  assert.match(html, /\.main \{\s*padding-top:76px!important/s);
});
test('las actuaciones usan botones de dos columnas y filas de marcha legibles en móvil', () => {
  assert.match(html, /event-card-actions \{\s*display:grid!important;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/s);
  assert.match(html, /march-line \{\s*display:grid!important;grid-template-columns:29px minmax\(0,1fr\)!important/s);
  assert.match(js, /loc-col \${p\.location\?\'has-value\':\'is-empty\'}/);
  assert.match(js, /last-col \${p\.notes\?\'has-value\':\'is-empty\'}/);
});
test('versión visual actual y caché PWA renovada', () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version, '1.13.1');
  assert.match(workflows, /const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(workflows, /version:'1\.8\.8'.*Rediseño responsive de actuaciones/s);
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});
