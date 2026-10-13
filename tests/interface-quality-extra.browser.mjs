import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const tools=process.env.BMM_BROWSER_TOOLS;
if(!tools)throw new Error('Indica BMM_BROWSER_TOOLS con Playwright, axe-core y pdfjs-dist instalados fuera del proyecto.');
const {chromium}=await import(pathToFileURL(path.join(tools,'playwright/index.mjs')));
const {getDocument}=await import(pathToFileURL(path.join(tools,'pdfjs-dist/legacy/build/pdf.mjs')));
const origin='http://localhost:8889';
const output=process.env.BMM_TEST_OUTPUT||'/tmp/bmm-interface-regression';
await fs.mkdir(output,{recursive:true});
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/bmm-synthetic.json',import.meta.url)));
fixture.events[0].marches.at(-1).notes+=' BMMREGRESIONFILAFINAL35';
const browser=await chromium.launch();
const result={interactions:[],pdfs:[],performance:[],errors:[],modalAccessibility:[],screenshots:[]};
async function profile(data=fixture,offline=false){
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'es-ES',serviceWorkers:offline?'allow':'block'});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin||url.pathname.startsWith('/.netlify/functions/'))return route.abort();
    return route.continue();
  });
  await context.addInitScript(data=>{if(!localStorage.getItem('santacecilia-registro-v1'))localStorage.setItem('santacecilia-registro-v1',JSON.stringify(data));},data);
  if(offline)await context.addInitScript(()=>{window.__bmmReloadedForWorker=true;});
  const page=await context.newPage();await page.goto(origin);
  await page.locator('[data-action="local-mode"]').click();
  return {context,page};
}
async function check(name,task){
  try{result.interactions.push({name,ok:true,details:await task()});}
  catch(error){result.interactions.push({name,ok:false,message:error.message});result.errors.push({name,message:error.message});}
}
await check('ids-hostiles-no-crean-eventos-html',async()=>{
  const data=structuredClone(fixture),payload='id" onclick="window.__bmmInjectionCounter=(window.__bmmInjectionCounter||0)+1" data-test="';
  data.events[0].id=payload;data.repertoire[0].id=payload;
  data.events[0].marches.forEach(performance=>performance.marchId=payload);
  const {context,page}=await profile(data);
  await page.evaluate(()=>setPage('actuaciones'));
  assert.equal(await page.locator('#content [onclick]').count(),0);
  await page.evaluate(payload=>{const button=[...document.querySelectorAll('[data-action="edit-event"]')].find(button=>button.dataset.id===payload);button.click();},payload);
  assert.equal(await page.evaluate(()=>window.__bmmInjectionCounter||0),0);
  assert.equal(await page.locator('#eventForm [name="eventId"]').inputValue(),payload);
  await page.keyboard.press('Escape');await page.evaluate(()=>setPage('repertorio'));
  assert.equal(await page.locator('#content [onclick]').count(),0);
  await context.close();return {executedHandlers:0,originalIdPreserved:true};
});
const {context,page}=await profile();
await check('crud-actuacion-y-recarga',async()=>{
  const original=await page.evaluate(()=>state.events.length);
  await page.locator('.topbar [data-action="add-event"]').click();await page.locator('#eventForm [name="name"]').fill('Evento de regresión ñ, acentos y (paréntesis)');
  await page.locator('[form="eventForm"][type="submit"]').click();
  assert.equal(await page.evaluate(()=>state.events.length),original+1);
  await page.reload();await page.locator('[data-action="local-mode"]').click();
  assert.equal(await page.evaluate(()=>state.events.length),original+1);
});
await check('duplicado-marcha-conserva-etiquetas-unicas',async()=>{
  await page.evaluate(()=>eventForm(state.events[0]));
  await page.locator('[data-action="duplicate-march-row"]').first().click();
  const duplicateIds=await page.evaluate(()=>{const ids=[...document.querySelectorAll('#modal [id]')].map(node=>node.id);return ids.filter((id,index)=>ids.indexOf(id)!==index);});
  assert.deepEqual(duplicateIds,[]);
  page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');
});
await check('menu-cierre-visible-y-foco',async()=>{
  for(const width of [320,768,1024,1180]){
    const height=width===768?1024:width===1024?768:820;
    await page.setViewportSize({width,height});await page.locator('#bmmDrawerToggle').click();
    assert.equal(await page.locator('.bmm-drawer-close').isVisible(),true);
    if(width===768||width===1024){const filename=`menu-abierto-${width}x${height}.png`;await page.screenshot({path:path.join(output,filename)});result.screenshots.push(filename);}
    await page.locator('.bmm-drawer-close').click();assert.equal(await page.locator('#bmmDrawerToggle').getAttribute('aria-expanded'),'false');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'bmmDrawerToggle');
  }
});
await check('modal-altura-reducida-y-validacion',async()=>{
  await page.setViewportSize({width:390,height:300});await page.locator('.topbar [data-action="add-event"]').click();
  await page.locator('#eventForm [name="name"]').fill('');await page.locator('[form="eventForm"][type="submit"]').click();
  assert.equal(await page.locator('#modalBackdrop').evaluate(back=>back.classList.contains('open')),true);
  const footer=await page.locator('.modal-footer').boundingBox();assert.ok(footer.y+footer.height<=300);
  page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');
});
await page.setViewportSize({width:1366,height:768});
await page.addScriptTag({path:path.join(tools,'axe-core/axe.min.js')});
for(const form of ['march','event','bulk']){
  await page.evaluate(form=>{if(form==='march')marchForm(null);else if(form==='event')eventForm(null);else{setPage('actuaciones');document.querySelector('[data-action="bmm-bulk-march-editor"]').click();}},form);
  const violations=await page.evaluate(async()=>{const results=await axe.run(document.getElementById('modal'));return results.violations.map(violation=>({id:violation.id,impact:violation.impact,targets:violation.nodes.map(node=>node.target)}));});
  result.modalAccessibility.push({form,violations});
  await page.keyboard.press('Escape');
}
await check('fallback-impresion-solo-una-invocacion',async()=>{
  await page.evaluate(()=>{
    window.__bmmPrintCalls=0;window.__bmmOriginalOpen=window.open;window.open=()=>null;
    const original=document.createElement.bind(document);
    document.createElement=function(tag,...args){const element=original(tag,...args);if(tag.toLowerCase()==='iframe')Object.defineProperty(element,'contentWindow',{get(){return {addEventListener(){},focus(){},print(){window.__bmmPrintCalls++;}}}});return element;};
    setPage('informes');printReport();
    document.createElement=original;
  });
  await page.waitForTimeout(1400);const calls=await page.evaluate(()=>window.__bmmPrintCalls);
  assert.equal(calls,1);await page.evaluate(()=>window.open=window.__bmmOriginalOpen);return {calls};
});
await check('pdf-a4-modos-orientaciones-y-filas',async()=>{
  await page.evaluate(()=>setPage('informes'));
  const types=['events','repertoire','timeline','groups','analytics','full'];
  for(const type of types)for(const orientation of ['portrait','landscape']){
    await page.evaluate(({type,orientation})=>{
      const typeControl=document.querySelector('#reportType');
      typeControl.value=type;typeControl.dispatchEvent(new Event('change',{bubbles:true}));
      const orientationControl=document.querySelector('#reportOrientation');
      orientationControl.value=orientation;orientationControl.dispatchEvent(new Event('change',{bubbles:true}));
    },{type,orientation});
    const popupPromise=page.waitForEvent('popup');await page.evaluate(()=>printReport());const documentPage=await popupPromise;
    await documentPage.waitForLoadState('load');await documentPage.evaluate(()=>document.fonts.ready);
    const bytes=await documentPage.pdf({path:path.join(output,`informe-${type}-${orientation}.pdf`),preferCSSPageSize:true,printBackground:true});
    const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true}),pdf=await task.promise;
    let outside=0,text='';
    const firstViewport=(await pdf.getPage(1)).getViewport({scale:1});
    assert.equal(firstViewport.width>firstViewport.height,orientation==='landscape');
    for(let number=1;number<=pdf.numPages;number++){
      const pdfPage=await pdf.getPage(number),viewport=pdfPage.getViewport({scale:1}),content=await pdfPage.getTextContent();
      text+=content.items.map(item=>item.str).join(' ');
      for(const item of content.items){if(!item.str.trim())continue;const xpos=item.transform[4],ypos=item.transform[5];if(xpos< -1||ypos< -1||xpos+item.width>viewport.width+1||ypos>viewport.height+1)outside++;}
    }
    const lastRowMarker=text.replace(/\s+/g,'').includes('BMMREGRESIONFILAFINAL35');
    if(['events','timeline','full'].includes(type))assert.equal(lastRowMarker,true);
    result.pdfs.push({type,orientation,pages:pdf.numPages,outside,textLength:text.length,lastRowMarker});
    assert.equal(outside,0);assert.ok(text.length>50);await task.destroy();await documentPage.close();
  }
  for(const type of ['event-detail','march-detail','members','calendar-day','calendar-month'])for(const orientation of ['portrait','landscape']){
    await page.evaluate(orientation=>{setPage('informes');const control=document.getElementById('reportOrientation');control.value=orientation;control.dispatchEvent(new Event('change',{bubbles:true}));},orientation);
    const popupPromise=page.waitForEvent('popup');
    await page.evaluate(type=>{
      const action=type==='event-detail'?'event-pdf':type==='march-detail'?'march-pdf':type==='members'?'members-pdf':type==='calendar-day'?'calendar-pdf-day':'calendar-pdf-month';
      if(type==='calendar-day'||type==='calendar-month')setPage('calendario');
      const button=document.createElement('button');button.dataset.action=action;button.dataset.id=type==='march-detail'?state.repertoire[0].id:state.events[0].id;handleAction(button);
    },type);
    const documentPage=await popupPromise;await documentPage.waitForLoadState('load');
    const bytes=await documentPage.pdf({path:path.join(output,`informe-${type}-${orientation}.pdf`),preferCSSPageSize:true,printBackground:true});
    const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true}),pdf=await task.promise;
    const firstViewport=(await pdf.getPage(1)).getViewport({scale:1});assert.equal(firstViewport.width>firstViewport.height,orientation==='landscape');
    let outside=0,text='';
    for(let number=1;number<=pdf.numPages;number++){
      const pdfPage=await pdf.getPage(number),viewport=pdfPage.getViewport({scale:1}),content=await pdfPage.getTextContent();text+=content.items.map(item=>item.str).join(' ');
      for(const item of content.items){if(!item.str.trim())continue;const xpos=item.transform[4],ypos=item.transform[5];if(xpos< -1||ypos< -1||xpos+item.width>viewport.width+1||ypos>viewport.height+1)outside++;}
    }
    const lastRowMarker=text.replace(/\s+/g,'').includes('BMMREGRESIONFILAFINAL35');
    if(['event-detail','calendar-day','calendar-month'].includes(type))assert.equal(lastRowMarker,true);
    result.pdfs.push({type,orientation,pages:pdf.numPages,outside,textLength:text.length,lastRowMarker});
    assert.equal(outside,0);assert.ok(text.length>50);await task.destroy();await documentPage.close();
  }
  return {documents:result.pdfs.length,pages:result.pdfs.reduce((sum,pdf)=>sum+pdf.pages,0)};
});
await check('rendimiento-volumen-sintetico',async()=>{
  await page.evaluate(fixture=>{
    state.repertoire=Array.from({length:200},(_,index)=>({...fixture.repertoire[index%fixture.repertoire.length],id:`large-march-${index}`}));
    state.events=Array.from({length:500},(_,index)=>({...fixture.events[index%fixture.events.length],id:`large-event-${index}`,date:'2026-09-10',marches:Array.from({length:10},(_,order)=>({marchId:`large-march-${(index+order)%200}`,order:order+1}))}));
  },fixture);
  for(const screen of ['repertorio','analitica','actuaciones']){
    const times=[];for(let count=0;count<3;count++)times.push(await page.evaluate(screen=>{const start=performance.now();setPage(screen);document.getElementById('content').getBoundingClientRect();return performance.now()-start;},screen));
    result.performance.push({screen,times,events:500,marches:200,performances:5000});
  }
  return result.performance;
});
await context.close();
await check('pwa-nuevo-shell-offline-local',async()=>{
  const {context,page}=await profile(fixture,true);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.locator('[data-action="local-mode"]').click();
  const cached=await page.evaluate(async()=>{const cache=await caches.open('bmm-santa-cecilia-v1.13.1-kpi-clean-build-20261012');return !!(await cache.match('/assets/css/interface-quality.css'))&&!!(await cache.match('/assets/js/interface-quality.js'));});
  assert.equal(cached,true);await context.setOffline(true);await page.reload();await page.locator('[data-action="local-mode"]').click();
  assert.equal(await page.evaluate(()=>state.events.length),fixture.events.length);await context.close();
});
await browser.close();
await fs.writeFile(path.join(output,'resultados-adicionales.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;
