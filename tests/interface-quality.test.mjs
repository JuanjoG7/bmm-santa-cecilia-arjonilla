import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bootstrap=fs.readFileSync(new URL('../assets/js/app-bootstrap.js',import.meta.url),'utf8');
const workflows=fs.readFileSync(new URL('../assets/js/app-workflows.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/css/interface-quality.css',import.meta.url),'utf8');
const quality=fs.readFileSync(new URL('../assets/js/interface-quality.js',import.meta.url),'utf8');
const bulk=fs.readFileSync(new URL('../assets/js/marches-order-bulk.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('las fechas imposibles no llegan al formateador de gráficos',()=>{
  const source=workflows.split('\n').find(line=>line.startsWith('  const bmmDate ='));
  const parse=vm.runInNewContext(`${source};bmmDate`);
  assert.equal(parse('2026-13-01'),null);
  assert.equal(parse('2026-02-30'),null);
  assert.equal(parse(''),null);
  assert.equal(parse('fecha no válida'),null);
  assert.equal(parse('2024-02-29').getDate(),29);
  assert.ok(parse('2026-10-12'));
  assert.match(workflows,/if\(bmmDate\(event.date\)\)/);
});

test('los IDs importados se escapan sin sustituirlos ni alterar sus valores',()=>{
  for(const source of [bootstrap,workflows,bulk])assert.doesNotMatch(source,/data-id="\$\{(?:e|m|ev|g)\.id\}"|value="\$\{(?:e|m|ev|g)\.id\}"/);
  const source=bootstrap.split('\n').find(line=>line.startsWith('function esc('));
  const escape=vm.runInNewContext(`${source};esc`);
  assert.equal(escape('registro" onclick="alert(1)'), 'registro&quot; onclick=&quot;alert(1)');
  assert.equal(escape("ñ & < > '"),'ñ &amp; &lt; &gt; &#39;');
});

test('el índice de marchas conserva repeticiones, orden y referencias',()=>{
  const source=bootstrap.split('\n').find(line=>line.startsWith('function allPlays('));
  const indexSource=bootstrap.split('\n').find(line=>line.startsWith('function bmmCatalogueIndex('));
  const state={repertoire:[{id:'march-1',name:'Prueba'}],events:[{id:'event-1',marches:[{marchId:'march-1',order:1},{marchId:'march-1',order:2},{marchId:'missing',order:3}]}]};
  state.repertoire.push({id:'march-1',name:'Duplicado que no sustituye a la primera ficha'});
  const result=vm.runInNewContext(`${indexSource};${source};allPlays()`,{state});
  assert.equal(result.length,2);
  assert.equal(result[0].order,1);
  assert.equal(result[1].order,2);
  assert.strictEqual(result[0].march,state.repertoire[0]);
  assert.strictEqual(result[0].event,state.events[0]);
});

test('el editor múltiple no invoca helpers privados de otro módulo',()=>{
  assert.doesNotMatch(bulk,/bmmGroup\(/);
  assert.match(bulk,/String\(ev.group\|\|''\).trim\(\)\|\|'Sin grupo'/);
  assert.match(bulk,/if\(result===false\)\{state.events=previousEvents;return;\}/);
});

test('drawer y modales comparten bloqueo de scroll, foco e inercia',()=>{
  assert.match(workflows,/matchMedia\('\(max-width: 1199px\)'\)/);
  assert.match(workflows,/compact.addEventListener\('change',\(\)=>closeDrawer\(false\)\)/);
  assert.match(workflows,/sidebar.inert=compact.matches/);
  assert.match(workflows,/bmmLockScroll\('drawer'\)/);
  assert.match(bootstrap,/bmmLockScroll\('modal'\)/);
  assert.match(bootstrap,/modal.setAttribute\('aria-modal','true'\)/);
  assert.match(bootstrap,/function requestModalClose\(/);
  assert.match(bootstrap,/Hay cambios sin guardar/);
  assert.match(bootstrap,/bmmModalTrigger.focus\(\{preventScroll:true\}\)/);
});

test('el papel blanco, objetivos táctiles y textos largos tienen reglas comunes',()=>{
  assert.match(css,/--bmm-touch-size: 44px/);
  assert.match(css,/--bmm-layer-modal: 300/);
  assert.match(css,/\.report-doc :is\(h1,h2,h3/);
  assert.match(css,/\.bar-label,.rank-name\).*white-space: normal/s);
  assert.match(css,/\.group-actions \{ display: flex !important; flex-wrap: wrap/);
  assert.match(quality,/bmmAssociateLabels/);
  assert.match(quality,/replacement\?\.focus/);
  assert.match(quality,/visualViewport\?\.addEventListener/);
});

test('la impresión fallback es única y el calendario no usa roles grid incompletos',()=>{
  assert.match(workflows,/if\(printed\|\|!frame.isConnected\)return/);
  assert.match(workflows,/printed=true;clearTimeout\(fallbackTimer\)/);
  assert.doesNotMatch(workflows,/class="bmm-calendar-grid" role="grid"/);
  assert.match(workflows,/class="bmm-calendar-grid" role="group"/);
  assert.match(sw,/'\/assets\/css\/interface-quality.css'/);
  assert.match(sw,/'\/assets\/js\/interface-quality.js'/);
});
