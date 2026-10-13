import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const documentHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const html = [documentHtml, ...['app-bootstrap.js','app-workflows.js','theme-palette.js','marches-order-bulk.js'].map(name => fs.readFileSync(path.join(ROOT, 'assets/js', name), 'utf8'))].join('\n');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
test('PDF compartido extrae encabezados semánticos y filas de tablas', () => {
  assert.match(html, /function bmmReportMarkupToLines\(markup\)/);
  assert.match(html, /cells\.join\('  \\|  '\)/);
  assert.match(html, /add\(clean\(node\),tag\)/);
});
test('PDF compartido utiliza A4 físico y numera páginas', () => {
  assert.match(html, /MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(html, /Página '\+\(index\+1\)\+' de '\+pages\.length/);
});
test('botón de compartir usa la misma estructura del informe y comparte un PDF', () => {
  assert.match(html, /const markup=bmmReportContent\(type,title,events\);const lines=bmmReportMarkupToLines\(markup\)/);
  assert.match(html, /new File\(\[blob\],bmmSafeName\(title\)\+'\.pdf',\{type:'application\/pdf'\}\)/);
  assert.match(html, /navigator\.share\(\{title,text:'Informe PDF/);
});
test('la PWA tiene una caché nueva para la versión actual', () => {
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});
test('el historial visible conserva el historial de versiones anteriores', () => {
  assert.match(html, /version:'1\.9\.0'.*Fase 1 · Sistema visual común/s);
  assert.match(html, /version:'1\.8\.3'.*Corrección de acceso en producción/s);
});
