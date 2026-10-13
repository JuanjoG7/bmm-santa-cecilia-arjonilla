import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets/css/phase1-visual-system.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const workflows = fs.readFileSync(path.join(ROOT, 'assets/js/app-workflows.js'), 'utf8');

test('la Fase 1 carga su hoja visual común después de los estilos de aplicación', () => {
  assert.match(html, /href="\/assets\/css\/phase1-visual-system\.css"/);
  assert.match(sw, /'\/assets\/css\/phase1-visual-system\.css'/);
});

test('los modales mantienen el cuerpo desplazable y las acciones separadas', () => {
  assert.match(css, /\.modal-content\s*\{[^}]*overflow:\s*auto/s);
  assert.match(css, /\.modal-footer\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /safe-area-inset-bottom/);
});

test('la hoja visual cubre campos, botones, tablas y textos largos sin tocar la lógica de guardado', () => {
  assert.match(css, /\.field input/);
  assert.match(css, /\.btn:active/);
  assert.match(css, /\.data-table/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  const cloudState = fs.readFileSync(path.join(ROOT, 'netlify/functions/state.mjs'), 'utf8');
  assert.match(cloudState, /setJSON\('state\.json'/);
});

test('el parche de versión y caché PWA están alineados', () => {
  assert.equal(pkg.version, '1.13.1');
  assert.match(workflows, /const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});
