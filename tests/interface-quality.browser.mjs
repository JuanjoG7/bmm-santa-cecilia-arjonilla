import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const tools=process.env.BMM_BROWSER_TOOLS;
if(!tools)throw new Error('Indica BMM_BROWSER_TOOLS con un directorio externo que contenga Playwright y axe-core; no se instalan dependencias del proyecto.');
const {chromium}=await import(pathToFileURL(path.join(tools,'playwright/index.mjs')));
const origin=process.env.BMM_LOCAL_ORIGIN||'http://localhost:8889';
assert.match(origin,/^http:\/\/(localhost|127\.0\.0\.1):8889$/);
const output=process.env.BMM_TEST_OUTPUT||'/tmp/bmm-interface-regression';
await fs.mkdir(output,{recursive:true});
const fixture=JSON.parse(await fs.readFile(new URL('./fixtures/bmm-synthetic.json',import.meta.url)));
const browser=await chromium.launch({headless:true});
const result={version:'1.13.1',scans:[],interactions:[],accessibility:[],errors:[],screenshots:[]};
const viewports=[[320,640],[360,800],[390,844],[430,932],[600,960],[768,1024],[820,1180],[1024,768],[1180,820],[1366,768],[1440,900],[1920,1080]];
const modules=['dashboard','actuaciones','calendario','cronologia','repertorio','analitica','grupos','integrantes','informes','configuracion'];
async function contextFor(data=fixture,touch=false){
  const context=await browser.newContext({viewport:{width:1366,height:768},hasTouch:touch,isMobile:touch,serviceWorkers:'block',locale:'es-ES'});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin||url.pathname.startsWith('/.netlify/functions/'))return route.abort();
    return route.continue();
  });
  await context.addInitScript(data=>localStorage.setItem('santacecilia-registro-v1',JSON.stringify(data)),data);
  return context;
}
async function capture(page,name){
  const filename=name+'.png';await page.screenshot({path:path.join(output,filename),fullPage:true});result.screenshots.push(filename);
}
async function selectTheme(page,theme){
  await page.evaluate(()=>setPage('configuracion'));
  await page.locator(`[data-theme-option="${theme}"]`).click();
  await page.waitForFunction(theme=>document.documentElement.dataset.bmmResolvedTheme===theme,theme);
}
async function openApplication(page){
  await page.goto(origin);
  await page.locator('[data-action="local-mode"]').click();
  await page.waitForFunction(()=>!document.getElementById('bmmLoginShell')&&document.querySelector('#content .page-head'));
}
async function scan(touch=false,empty=false){
  const data=empty?{...fixture,events:[],repertoire:[],members:[],groupsCatalog:[]}:fixture;
  const context=await contextFor(data,touch),page=await context.newPage();
  page.on('pageerror',error=>result.errors.push({type:'pageerror',message:error.message,touch,empty}));
  await openApplication(page);
  const sizes=empty?[[320,640],[768,1024],[1366,768]]:touch?viewports.slice(0,9):viewports;
  for(const [width,height] of sizes){
    await page.setViewportSize({width,height});
    for(const theme of empty?['light']:['light','dark']){
      await selectTheme(page,theme);
      for(const screen of modules){
      await page.evaluate(screen=>setPage(screen),screen);
      await page.waitForTimeout(25);
      const measured=await page.evaluate(()=>{
        const title=document.getElementById('topTitle').getBoundingClientRect();
        const header=document.querySelector('.topbar').getBoundingClientRect();
        const search=document.querySelector('#repSearch')?.getBoundingClientRect();
        return {scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,headerHeight:header.height,titleWidth:title.width,searchWidth:search?.width,sidebarInert:document.querySelector('.sidebar').inert,renderError:document.querySelector('.render-error')?.innerText||null};
      });
      const record={width,height,theme,screen,touch,empty,...measured};result.scans.push(record);
      if(measured.scrollWidth>width+1||measured.titleWidth<1||measured.headerHeight>150||measured.renderError||measured.searchWidth===0)result.errors.push({type:'layout',...record});
      if(!empty&&!touch&&[320,768,1024,1366].includes(width)&&['dashboard','grupos','repertorio','informes'].includes(screen))await capture(page,`${theme}-${screen}-${width}x${height}`);
      }
    }
  }
  await context.close();
}
async function check(name,task){
  try{const details=await task();result.interactions.push({name,ok:true,details});}
  catch(error){result.interactions.push({name,ok:false,message:error.message});result.errors.push({type:'interaction',name,message:error.message});}
}
await scan();await scan(true);await scan(false,true);
const context=await contextFor(),page=await context.newPage();
await openApplication(page);
await check('drawer-tablet-scroll-orientacion-teclado',async()=>{
  for(const [width,height] of viewports.slice(0,9)){
    await page.setViewportSize({width,height});await page.evaluate(()=>setPage('repertorio'));await page.waitForTimeout(100);
    assert.equal(await page.locator('#bmmDrawerToggle').isVisible(),true);
    await page.evaluate(()=>window.scrollTo(0,300));const before=await page.evaluate(()=>window.scrollY);
    await page.locator('#bmmDrawerToggle').click();assert.equal(await page.locator('#bmmDrawerToggle').getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#bmmDrawerToggle').getAttribute('aria-expanded'),'false');
    assert.equal(await page.evaluate(()=>window.scrollY),before);
    assert.equal(await page.locator('.sidebar').evaluate(sidebar=>sidebar.inert),true);
    await page.locator('#bmmDrawerToggle').click();await page.locator('#bmmDrawerBackdrop').click({position:{x:width-2,y:height/2}});
    assert.equal(await page.locator('#bmmDrawerToggle').getAttribute('aria-expanded'),'false');
  }
  await page.setViewportSize({width:768,height:1024});await page.locator('#bmmDrawerToggle').click();
  await page.setViewportSize({width:1024,height:768});assert.equal(await page.locator('#bmmDrawerToggle').getAttribute('aria-expanded'),'true');
  await page.setViewportSize({width:1366,height:768});await page.setViewportSize({width:768,height:1024});
  assert.equal(await page.locator('#bmmDrawerToggle').getAttribute('aria-expanded'),'false');
  await page.locator('#bmmDrawerToggle').click();await page.locator('#nav [data-page="integrantes"]').click();
  assert.equal(await page.locator('#bmmDrawerToggle').getAttribute('aria-expanded'),'false');assert.match(await page.locator('#content').innerText(),/Integrantes/);
});
await check('modal-capas-foco-descarte-rotacion',async()=>{
  await page.setViewportSize({width:320,height:640});await page.locator('.topbar [data-action="add-event"]').click();
  assert.equal(await page.locator('#modal').getAttribute('role'),'dialog');
  const hit=await page.locator('#modal [name="date"]').evaluate(input=>{const rect=input.getBoundingClientRect();return input===document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);});assert.equal(hit,true);
  for(let count=0;count<30;count++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.getElementById('modal').contains(document.activeElement)),true);}
  await page.locator('#modal [name="name"]').fill('Prueba ñ y título largo (sin guardar)');
  page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');assert.equal(await page.locator('#modalBackdrop').evaluate(back=>back.classList.contains('open')),true);
  await page.setViewportSize({width:1024,height:768});assert.match(await page.locator('#modal [name="name"]').inputValue(),/Prueba ñ/);
  await capture(page,'modal-tablet-1024x768');
  page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');
  assert.equal(await page.locator('#modalBackdrop').evaluate(back=>back.classList.contains('open')),false);
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-action')),'add-event');
});
await check('repertorio-filtro-conserva-foco',async()=>{
  await page.setViewportSize({width:768,height:1024});await page.evaluate(()=>setPage('repertorio'));
  const select=page.locator('#repStyle');await select.focus();const value=await select.locator('option').last().getAttribute('value');await select.selectOption(value);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'repStyle');assert.equal(await page.locator('#repStyle').inputValue(),value);
});
await check('edicion-multiple-abre-y-guarda',async()=>{
  await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>setPage('actuaciones'));
  await page.locator('[data-action="bmm-bulk-march-editor"]').click();
  assert.equal(await page.locator('#bmmBulkMarchForm').isVisible(),true);
  await page.locator('[name="bmmBulkEventIds"]').first().check();await page.locator('[name="bmmBulkMarchIds"]').first().check();
  const eventId=await page.locator('[name="bmmBulkEventIds"]').first().inputValue();const count=await page.evaluate(id=>state.events.find(event=>event.id===id).marches.length,eventId);
  page.once('dialog',dialog=>dialog.accept());await page.locator('[form="bmmBulkMarchForm"]').click();
  assert.equal(await page.evaluate(id=>state.events.find(event=>event.id===id).marches.length,eventId),count+1);
});
await check('fecha-invalida-no-rompe-render',async()=>{
  await page.evaluate(()=>{state.events.push({...state.events[0],id:'invalid-date',date:'2026-13-01'});});
  for(const screen of ['dashboard','analitica','calendario']){await page.evaluate(screen=>setPage(screen),screen);assert.equal(await page.locator('.render-error').count(),0);}
});
await page.addScriptTag({path:path.join(tools,'axe-core/axe.min.js')});
for(const theme of ['light','dark']){
  await selectTheme(page,theme);
  for(const screen of modules){
  await page.evaluate(screen=>setPage(screen),screen);await page.waitForTimeout(30);
  const violations=await page.evaluate(async()=>{const results=await axe.run(document,{rules:{'region':{enabled:false}}});return results.violations.map(violation=>({id:violation.id,impact:violation.impact,nodes:violation.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));});
  result.accessibility.push({screen,theme,violations});
  }
}
await context.close();await browser.close();
await fs.writeFile(path.join(output,'resultados.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({scans:result.scans.length,interactions:result.interactions,errors:result.errors,accessibility:result.accessibility.map(record=>({screen:record.screen,theme:record.theme,rules:record.violations.map(violation=>violation.id)})),screenshots:result.screenshots.length},null,2));
if(result.errors.length)process.exitCode=1;
