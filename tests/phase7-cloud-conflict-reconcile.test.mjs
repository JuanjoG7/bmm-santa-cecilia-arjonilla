import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflows = fs.readFileSync(path.join(ROOT, 'assets/js/app-workflows.js'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('solo se considera misma base cuando ambas copias tienen la misma marca de nube no vacía', () => {
  const start = workflows.indexOf('  const bmmSameCloudBaseRevision=');
  const end = workflows.indexOf('\n', start);
  assert.ok(start >= 0 && end > start);
  const source = workflows.slice(start, end).replace('  const bmmSameCloudBaseRevision=', 'const bmmSameCloudBaseRevision=');
  const helper = vm.runInNewContext(`${source}; bmmSameCloudBaseRevision`);
  assert.equal(helper({cloudUpdatedAt:'2026-10-12T10:00:00.000Z'}, {cloudUpdatedAt:'2026-10-12T10:00:00.000Z'}), true);
  assert.equal(helper({cloudUpdatedAt:'2026-10-12T09:00:00.000Z'}, {cloudUpdatedAt:'2026-10-12T10:00:00.000Z'}), false);
  assert.equal(helper({cloudUpdatedAt:null}, {cloudUpdatedAt:null}), false);
});

test('al inicio conserva el estado local pendiente si comparte la misma revisión y usa el ETag recién leído', () => {
  const start = workflows.indexOf('if(localUsable&&!samePayload&&!sameAfterLegacyIdNormalization){', workflows.indexOf('bmmLoadCloud=async function'));
  const end = workflows.indexOf('      if(bmmHasUnresolvedLocalRecovery())', start);
  assert.ok(start >= 0 && end > start);
  const block = workflows.slice(start, end);
  assert.match(block, /data\.etag\s*&&\s*bmmSameCloudBaseRevision\(state,remote\)/);
  assert.match(block, /bmmCloudEtag=data\.etag/);
  assert.match(block, /bmmCloudStartupSyncNeeded=true/);
  assert.match(block, /bmmCloudConflictState=null/);
  assert.match(block, /bmmCloudConflictState=remote/);
});

test('el conflicto durante POST permite solo un reintento si la revisión de nube no ha avanzado', () => {
  const start = workflows.indexOf('if(r.status===409&&body.conflict)', workflows.indexOf('const expectedEtag='));
  const end = workflows.indexOf("      if(!r.ok)throw new Error", start);
  assert.ok(start >= 0 && end > start);
  const block = workflows.slice(start, end);
  assert.match(block, /bmmSameCloudBaseRevision\(snapshot,remote\)/);
  assert.match(block, /expectedCloudEtag:body\.etag/);
  assert.match(block, /La nube volvió a cambiar durante el reintento seguro/);
});

test('revisión posterior auténtica sigue requiriendo resolución explícita y la cache se renueva', () => {
  assert.match(workflows, /La nube contiene una versión realmente posterior a la última base de este dispositivo/);
  assert.equal(pkg.version, '1.13.1');
  assert.match(sw, /v1\.13\.1-kpi-clean-build-20261012/);
});

test('los identificadores de registros antiguos sin ID son deterministas entre normalizaciones', () => {
  const start = workflows.indexOf('  function bmmStableId(prefix, value){');
  const end = workflows.indexOf('\n  }', start) + '\n  }'.length;
  assert.ok(start >= 0 && end > start);
  const helperSource = workflows.slice(start, end).replace('  function bmmStableId', 'function bmmStableId');
  const helper = vm.runInNewContext(`${helperSource}; bmmStableId`);
  const legacyMarch = ['Marcha legacy', 'Autor ejemplo', 3];
  assert.equal(helper('march', legacyMarch), helper('march', legacyMarch));
  assert.notEqual(helper('march', legacyMarch), helper('march', ['Otra marcha', 'Autor ejemplo', 3]));
  assert.match(workflows, /bmmStableId\('march'/);
  assert.match(workflows, /bmmStableId\('event'/);
  assert.match(workflows, /bmmStableId\('perf'/);
  assert.match(workflows, /bmmStableId\('member'/);
});

test('la reconciliación ignora únicamente IDs ausentes en la copia antigua y conserva diferencias musicales reales', () => {
  const start = workflows.indexOf('  function bmmCanonicalPayload(value,isRoot=true){');
  const end = workflows.indexOf('  // A local snapshot can contain unsynced edits', start);
  assert.ok(start >= 0 && end > start);
  const block = workflows.slice(start, end);
  const helpers = `const clone=value=>JSON.parse(JSON.stringify(value));\n${block}\n;({bmmEquivalentAfterLegacyIdNormalization,bmmPayloadForComparison})`;
  const api = vm.runInNewContext(helpers);
  const raw = {
    repertoire:[{name:'Marcha ejemplo',author:'Autor'}],
    events:[{date:'2026-10-11',time:'10:00',name:'Procesión',group:'Semana Santa',category:'Procesión',locality:'Arjonilla',status:'Realizado',marches:[{marchId:'m-1',order:1}]}],
    groupsCatalog:[{name:'Semana Santa'}],
    members:[]
  };
  const normalizedRemote = {
    repertoire:[{id:'stable-march',name:'Marcha ejemplo',author:'Autor',style:'',genre:'',season:'',difficulty:'',yearComposed:'',publisher:'',notes:'',tags:[]}],
    events:[{id:'stable-event',date:'2026-10-11',time:'10:00',name:'Procesión',group:'Semana Santa',category:'Procesión',locality:'Arjonilla',status:'Realizado',notes:'',organizer:'',route:'',duration:'',startPlace:'',endPlace:'',tags:[],marches:[{id:'stable-performance',marchId:'m-1',location:'',order:1,notes:'',startTime:'',duration:''}]}],
    groupsCatalog:[{id:'stable-group',name:'Semana Santa',description:'',color:'#236b45'}],
    members:[],categories:[],auditLog:[],settings:{organization:'BMM Santa Cecilia de Arjonilla',theme:'forest-gold'},version:3
  };
  const local = JSON.parse(JSON.stringify(normalizedRemote));
  local.repertoire[0].id='old-random-id';
  local.events[0].id='old-random-event-id';
  local.events[0].marches[0].id='old-random-performance-id';
  local.groupsCatalog[0].id='old-random-group-id';
  assert.equal(api.bmmEquivalentAfterLegacyIdNormalization(local, normalizedRemote, raw), true);
  local.events[0].name='Procesión modificada localmente';
  assert.equal(api.bmmEquivalentAfterLegacyIdNormalization(local, normalizedRemote, raw), false);
});
