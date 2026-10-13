import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflows = fs.readFileSync(path.join(ROOT, 'assets/js/app-workflows.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('una fecha de actuación pasada completa automáticamente la actuación, salvo que esté cancelada', () => {
  const start = workflows.indexOf('  const bmmTodayKey =');
  const end = workflows.indexOf('  let bmmCloudAutoCompletionPending = 0;', start) + '  let bmmCloudAutoCompletionPending = 0;'.length;
  assert.ok(start >= 0 && end > start, 'se localiza el normalizador común de estados');
  const source = workflows.slice(start, end).replace(/const bmmTodayKey = \(\) => \{[^\n]+\};/, "const bmmTodayKey = () => '2026-10-12';");
  const helpers = vm.runInNewContext(`${source};({bmmEffectiveEventStatus,bmmCountOverdueIncomplete,bmmStatus})`);
  assert.equal(helpers.bmmEffectiveEventStatus('2026-10-11', 'Planificado'), 'Realizado');
  assert.equal(helpers.bmmEffectiveEventStatus('2026-10-11', 'Cancelado'), 'Cancelado');
  assert.equal(helpers.bmmEffectiveEventStatus('2026-10-12', 'Planificado'), 'Planificado');
  assert.equal(helpers.bmmEffectiveEventStatus('2026-10-13', 'Finalizado'), 'Realizado');
  assert.equal(helpers.bmmCountOverdueIncomplete([
    {date:'2026-10-11',status:'Planificado'},
    {date:'2026-10-10',status:'Cancelado'},
    {date:'2026-10-09',status:'Realizado'},
    {date:'2026-10-12',status:'Planificado'}
  ]), 1);
});

test('la normalización y el guardado de actuaciones aplican el estado efectivo por fecha', () => {
  assert.match(workflows, /status:bmmEffectiveEventStatus\(String\(e\.date\|\|''\),e\.status\)/);
  assert.match(workflows, /const effectiveStatus=bmmEffectiveEventStatus\(eventDate,requestedStatus\)/);
  assert.match(workflows, /status:effectiveStatus/);
  assert.match(workflows, /function bmmStatusPlays\(events\)\{return \(Array\.isArray\(events\)\?events:\[\]\)\.filter\(e=>bmmStatus\(e\)==='Realizado'\);\}/);
  assert.match(workflows, /totalPlays=function\(events=state\.events\)\{return allPlays\(events\)\.length;\}/);
});

test('la nube persiste estados completados solo tras adoptar datos sin conflicto', () => {
  assert.match(workflows, /const remoteAutoCompletionCount=bmmCountOverdueIncomplete\(data\.state\.events\)/);
  assert.match(workflows, /bmmCloudAutoCompletionPending=remoteAutoCompletionCount;bmmCloudPending=remoteAutoCompletionCount>0/);
  assert.match(workflows, /save\(`Actuaciones completadas automáticamente por fecha \(\$\{count\}\)`\)/);
  assert.match(workflows, /if\(bmmCloudAutoCompletionPending>0&&!bmmCloudConflictState&&!bmmHasUnresolvedLocalRecovery\(\)&&!bmmFormDirty\)/);
  assert.match(workflows, /window\.setInterval\(bmmRunAutomaticCompletionCheck,60\*1000\)/);
  assert.match(workflows, /addEventListener\('visibilitychange'/);
  assert.match(workflows, /addEventListener\('pageshow',bmmRunAutomaticCompletionCheck\)/);
  assert.match(workflows, /addEventListener\('focus',bmmRunAutomaticCompletionCheck\)/);
});

test('la barra lateral fija usa drawer hasta 1199px y scroll independiente en escritorio', () => {
  const css=fs.readFileSync(path.join(ROOT,'assets/css/interface-quality.css'),'utf8');
  assert.match(html, /href="\/assets\/css\/interface-quality\.css"/);
  assert.match(css, /position: fixed !important/);
  assert.match(css, /overflow-y: auto !important/);
  assert.match(css, /@media \(min-width: 1200px\)[\s\S]*?margin-left: 256px !important/);
  assert.match(css, /@media \(max-width: 1199px\)[\s\S]*?margin-left: 0 !important/);
  assert.match(css, /body\.bmm-drawer-open \.sidebar \{ transform: translateX\(0\) !important/);
  assert.doesNotMatch(html, /id="bmm-fixed-sidebar-v192"/);
});

test('la versión y caché PWA se renuevan para esta corrección', () => {
  assert.equal(pkg.version, '1.13.1');
  assert.match(workflows, /const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(workflows, /version:'1\.9\.3'.*Corrección de conflictos de nube y sincronización segura/s);
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});
