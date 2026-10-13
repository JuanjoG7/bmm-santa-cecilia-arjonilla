import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflows=fs.readFileSync(path.join(ROOT,'assets/js/app-workflows.js'),'utf8');
const sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
function qualityHelper(){
  const start=workflows.indexOf('  function bmmBuildDataQualityReport(source=state){');
  const end=workflows.indexOf('\n  let bmmQualityQuery=',start);
  assert.ok(start>=0&&end>start,'helper source markers should exist');
  const source=workflows.slice(start,end).replace('  function bmmBuildDataQualityReport','function bmmBuildDataQualityReport');
  return vm.runInNewContext(`${source}; bmmBuildDataQualityReport`);
}
test('la calidad de datos detecta marchas duplicadas, autor/clasificación vacíos y eventos incompletos',()=>{
  const report=qualityHelper()({
    repertoire:[
      {id:'m1',name:'Ángeles del Cielo',author:'',style:''},
      {id:'m2',name:'angeles DEL cielo',author:'Autor B',style:'Procesional'},
      {id:'m3',name:'Marcha buena',author:'Autor C',style:'Himno'}
    ],
    events:[
      {id:'e1',date:'',name:'Procesión A',group:'',locality:'',status:'Planificado',marches:[]},
      {id:'e2',date:'2026-10-11',name:'Procesión B',group:'Semana Santa',locality:'Arjonilla',status:'Realizado',marches:[{marchId:'missing'}]},
      {id:'e3',date:'2026-10-12',name:'Evento futuro',group:'Conciertos',locality:'Arjonilla',status:'Planificado',marches:[{marchId:''}]},
      {id:'e4',date:'2026-10-12',name:'Evento futuro',group:'Conciertos',locality:'Arjonilla',status:'Planificado',marches:[]}
    ],members:[{id:'p1',name:'Músico',instrument:''}]
  });
  const codes=report.issues.map(x=>x.code);
  assert.ok(codes.includes('march-duplicate-title'));
  assert.ok(codes.includes('march-missing-author'));
  assert.ok(codes.includes('march-unclassified'));
  assert.ok(codes.includes('event-invalid-date'));
  assert.ok(codes.includes('event-without-marches'));
  assert.ok(codes.includes('event-broken-march-reference'));
  assert.ok(codes.includes('event-performance-without-march'));
  assert.ok(codes.includes('event-possible-duplicate'));
  assert.ok(codes.includes('member-missing-instrument'));
  assert.equal(report.scanned.marches,3);
  assert.equal(report.scanned.events,4);
});
test('la calidad de datos no informa como duplicado dos eventos con fecha o localidad diferente',()=>{
  const report=qualityHelper()({repertoire:[],members:[],events:[
    {id:'e1',date:'2026-10-11',name:'Procesión',group:'Semana Santa',locality:'Arjonilla',status:'Realizado',marches:[]},
    {id:'e2',date:'2026-10-12',name:'Procesión',group:'Semana Santa',locality:'Arjonilla',status:'Realizado',marches:[]},
    {id:'e3',date:'2026-10-11',name:'Procesión',group:'Semana Santa',locality:'Jaén',status:'Realizado',marches:[]}
  ]});
  assert.equal(report.issues.filter(x=>x.code==='event-possible-duplicate').length,0);
});
test('el panel de calidad permite abrir registros afectados y exportar incidencias',()=>{
  assert.match(workflows,/data-action="quality-open"/);
  assert.match(workflows,/data-action="quality-review"/);
  assert.match(workflows,/data-action="quality-export"/);
  assert.match(workflows,/No se corrigen ni eliminan datos automáticamente/);
  assert.match(workflows,/bmm-santa-cecilia-calidad-datos-/);
});
test('el historial filtra por sección, tipo y texto y exporta las filas filtradas',()=>{
  assert.match(workflows,/id="bmmAuditQuery"/);
  assert.match(workflows,/id="bmmAuditSection"/);
  assert.match(workflows,/id="bmmAuditKind"/);
  assert.match(workflows,/bmmAuditFilteredRows\(Number\.MAX_SAFE_INTEGER\)/);
  assert.match(workflows,/Actuación actualizada: '\+name/);
  assert.match(workflows,/Ficha de marcha actualizada: '\+name/);
});
test('el módulo de calidad de datos y la caché PWA están integrados',()=>{
  assert.equal(pkg.version,'1.13.1');
  assert.match(workflows,/const BMM_APP_VERSION = '1\.13\.1'/);
  assert.match(sw,/v1\.13\.1-kpi-clean-build-20261012/);
});
