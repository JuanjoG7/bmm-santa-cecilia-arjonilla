import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflows = fs.readFileSync(path.join(ROOT, 'assets/js/app-workflows.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'assets/css/phase1-visual-system.css'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('el repertorio principal omite la columna Estilo y mantiene el filtro por estilo', () => {
  const start = workflows.indexOf('renderRepertorio=function(){');
  const end = workflows.indexOf('// Make original schedule titles editable', start);
  assert.ok(start >= 0 && end > start, 'se encuentra la plantilla activa del repertorio');
  const section = workflows.slice(start, end);
  assert.match(section, /<select class="filter-select" id="repStyle"><option value="all">Todos los estilos<\/option>/);
  assert.match(section, /<th>Marcha<\/th><th>Autor \/ compositor<\/th><th>Veces tocada<\/th><th>Última interpretación<\/th><th>Acciones<\/th>/);
  assert.doesNotMatch(section, /<th>Estilo<\/th>/);
  assert.match(section, /<td colspan="5">/);
});

test('cada fila incluye metadatos móviles completos sin recortar el nombre ni el autor', () => {
  assert.match(workflows, /bmm-repertoire-mobile-meta/);
  assert.match(workflows, /bmm-repertoire-mobile-author/);
  assert.match(workflows, /bmm-repertoire-mobile-last/);
  assert.match(css, /\.bmm-repertoire-table \.primary-cell[\s\S]*?text-overflow: clip/);
  assert.match(css, /overflow-wrap: break-word/);
  assert.match(css, /word-break: normal/);
});

test('en móvil las filas del repertorio se convierten en fichas compactas con frecuencia y acciones', () => {
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.bmm-repertoire-table tbody tr[\s\S]*?grid-template-areas: "main count" "actions actions"/);
  assert.match(css, /\.bmm-repertoire-table tbody td:nth-child\(2\)[\s\S]*?display: none !important/);
  assert.match(css, /\.bmm-repertoire-table tbody td:nth-child\(4\)[\s\S]*?display: none !important/);
});

test('la versión actual actualiza historial y caché de la PWA', () => {
  assert.equal(pkg.version, '1.13.1');
  assert.match(workflows, /const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(workflows, /version:'1\.9\.1'.*Repertorio responsive sin columna de estilo/s);
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});
