import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const css = fs.readFileSync(path.join(ROOT, 'assets/css/interface-quality.css'), 'utf8');
const workflows = fs.readFileSync(path.join(ROOT, 'assets/js/app-workflows.js'), 'utf8');
const netlify = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'scripts/build.mjs'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('los KPI directos usan cuatro columnas iguales en escritorio y mantienen dos en móvil', () => {
  assert.match(workflows, /<div class="pro-grid" style="margin-bottom:17px">\$\{bmmProKpi/);
  assert.match(css, /\.content \.pro-grid > \.pro-kpi \{\s*grid-column:\s*span 3;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.content \.pro-grid > \.pro-kpi \{ grid-column: span 1 !important; \}/);
  assert.equal((workflows.match(/bmmProKpi\('(?:♟|✓|♫|＋)'/g) || []).length >= 4, true);
});

test('Netlify solo publica el resultado generado y conserva las funciones', () => {
  assert.match(pkg.scripts.build, /node scripts\/build\.mjs/);
  assert.match(netlify, /command = "npm run build"/);
  assert.match(netlify, /publish = "dist"/);
  assert.match(netlify, /functions = "netlify\/functions"/);
  assert.doesNotMatch(netlify, /publish = "\."/);
  assert.match(build, /index\.html/);
  assert.match(build, /manifest\.webmanifest/);
  assert.match(build, /sw\.js/);
  assert.match(build, /assets/);

  // Build an actual staging tree and assert the publish folder is allowlisted.
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, stdio: 'pipe' });
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'assets/js/app-workflows.js']) {
    assert.equal(fs.existsSync(path.join(ROOT, 'dist', file)), true, `Falta en dist: ${file}`);
  }
  for (const privateOrDevelopmentPath of ['tests', 'scripts', 'netlify.toml', 'package.json', 'README.md']) {
    assert.equal(fs.existsSync(path.join(ROOT, 'dist', privateOrDevelopmentPath)), false, `No debe publicarse: ${privateOrDevelopmentPath}`);
  }

  // Every absolute local link in the HTML and CSS must exist in the built output.
  const dist = path.join(ROOT, 'dist');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const localUrls = [...html.matchAll(/\b(?:src|href)=["'](\/[^"']+)["']/gi)].map(match => match[1]);
  const cssRoot = path.join(dist, 'assets');
  const visitCss = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visitCss(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.css')) {
        const source = fs.readFileSync(fullPath, 'utf8');
        for (const match of source.matchAll(/url\(["']?(\/[^"')]+)["']?\)/g)) localUrls.push(match[1]);
      }
    }
  };
  visitCss(cssRoot);
  for (const url of localUrls) {
    const cleanUrl = url.split(/[?#]/, 1)[0];
    const target = cleanUrl === '/' ? path.join(dist, 'index.html') : path.join(dist, cleanUrl.slice(1));
    assert.equal(fs.existsSync(target), true, `Recurso local no encontrado en dist: ${url}`);
  }
});

test('versión y caché PWA coinciden con el nuevo parche', () => {
  assert.equal(pkg.version, '1.13.1');
  assert.match(workflows, /const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(sw, /bmm-santa-cecilia-v1\.13\.1-kpi-clean-build-20261012/);
});
