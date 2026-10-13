import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflows = fs.readFileSync(path.join(ROOT, 'assets/js/app-workflows.js'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('la analítica calcula última y primera aparición desde las interpretaciones del periodo', () => {
  assert.ok(workflows.includes('lastEvent:appearances[0]?.event||null'));
  assert.ok(workflows.includes('firstEvent:appearances.at(-1)?.event||null'));
  assert.match(workflows, /Última interpretación/);
});

test('la analítica explica las unidades y diferencia interpretaciones de actuaciones distintas', () => {
  assert.match(workflows, /Actuaciones distintas/);
  assert.match(workflows, /cada aparición de una marcha anotada/);
  assert.match(workflows, /una sola vez por marcha/);
  assert.match(workflows, /Actuaciones sin marchas/);
});

test('la tabla de analítica permite abrir el historial de cada marcha y exportarlo', () => {
  assert.match(workflows, /data-action="march-insight" data-id="\$\{esc\(m\.id\)\}"/);
  assert.match(workflows, /data-action="export-march-stats-csv"/);
  assert.match(workflows, /bmmExportMarchStats/);
});

test('la versión de analítica renueva la caché PWA', () => {
  assert.equal(pkg.version, '1.13.1');
  assert.match(workflows, /const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});
