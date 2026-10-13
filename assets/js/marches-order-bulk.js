(() => {
  'use strict';
  // The multiselector supports count-per-march; checking a row then saving adds that many new appearances.
  const bmmQuickPickerBeforeV178 = quickMarchPicker;
  quickMarchPicker = function(){
    const options = state.repertoire.slice().sort((a,b)=>a.name.localeCompare(b.name,'es')).map(m=>{
      const search = (m.name+' '+(m.author||'')).toLocaleLowerCase('es');
      return `<div class="quick-march-option bmm-quick-march-v178" data-quick-name="${esc(search)}">
        <label class="bmm-quick-march-label"><input type="checkbox" name="quickMarchIds" value="${esc(m.id)}"><span><strong>${esc(m.name)}</strong>${m.author?`<small>${esc(m.author)}</small>`:''}</span></label>
        <div class="bmm-quick-march-actions"><label>Veces <input type="number" name="quickMarchCount" data-quick-count data-march-id="${esc(m.id)}" min="1" max="10" step="1" value="1" aria-label="Veces que se añade ${esc(m.name)}"></label><button type="button" class="btn btn-soft btn-small" data-action="quick-add-march" data-id="${esc(m.id)}">＋ Añadir</button></div>
      </div>`;
    }).join('');
    return `<details class="quick-pick"><summary>＋ Seleccionar varias marchas de una vez</summary><div class="quick-pick-tools"><input type="search" id="quickMarchSearch" placeholder="Buscar marchas o autores…"><button type="button" class="btn btn-soft btn-small" data-action="select-visible-marches">Seleccionar visibles</button></div><p class="bmm-order-hint">Marca varias marchas y guarda para añadirlas juntas. Para repetir una pieza, indica cuántas veces o pulsa «Añadir» tantas veces como necesites.</p><div class="quick-march-options">${options}</div><div class="footnote">Cada aparición se guarda por separado. Puedes cambiar su ubicación, hora y observaciones y ordenarla después con las flechas.</div></details>`;
  };

  // Replace the editable order number by a visible, automatically maintained position badge.
  const bmmMarchRowBeforeV178 = marchRowHtml;
  marchRowHtml = function(p={}){
    let html = bmmMarchRowBeforeV178(p);
    html = html.replace(/<div class="field"><label>Orden<\/label><input name="order" type="number" min="1" value="([^"]*)" placeholder="1"><\/div>/, (_, raw)=>{
      const order = String(parseInt(raw,10)||1);
      return `<div class="field bmm-order-field"><label>Posición automática</label><div class="bmm-order-pill" data-march-order-label>${order}</div><input type="hidden" name="order" value="${esc(order)}"></div>`;
    });
    return html;
  };

  function bmmMarchRows(){ return [...(document.getElementById('marchRows')?.querySelectorAll('.march-row')||[])]; }
  function bmmRefreshMarchOrder(){
    const rows=bmmMarchRows();
    rows.forEach((row,index)=>{
      const n=String(index+1);
      const order=row.querySelector('[name="order"]'); if(order)order.value=n;
      const source=row.querySelector('[name="sourceStop"]'); if(source)source.value=n;
      const label=row.querySelector('[data-march-order-label]'); if(label)label.textContent=n;
      const up=row.querySelector('[data-action="move-march-up"]'); if(up){up.disabled=index===0;up.title=index===0?'Ya es la primera marcha':'Subir una posición';}
      const down=row.querySelector('[data-action="move-march-down"]'); if(down){down.disabled=index===rows.length-1;down.title=index===rows.length-1?'Ya es la última marcha':'Bajar una posición';}
    });
  }
  function bmmRenumberRowHtml(html){
    const order=bmmMarchRows().length+1;
    const holder=document.createElement('div'); holder.innerHTML=html;
    const row=holder.firstElementChild; if(!row)return html;
    const n=row.querySelector('[name="order"]'); if(n)n.value=String(order);
    const sn=row.querySelector('[name="sourceStop"]'); if(sn)sn.value=String(order);
    const badge=row.querySelector('[data-march-order-label]'); if(badge)badge.textContent=String(order);
    return row.outerHTML;
  }

  const bmmEventFormBeforeV178 = eventForm;
  eventForm = function(e){
    bmmEventFormBeforeV178(e);
    const form=document.getElementById('eventForm'); const rows=document.getElementById('marchRows');
    if(form&&rows&&!form.querySelector('.bmm-order-help')) rows.insertAdjacentHTML('beforebegin','<p class="bmm-order-hint bmm-order-help">Orden de interpretación: usa ↑ y ↓ para mover las marchas. La posición se numera sola al mover, añadir, duplicar o quitar una aparición.</p>');
    bmmRefreshMarchOrder();
  };

  // Multi-event editor: append selected march occurrences to every chosen performance without deleting existing rows.
  function bmmOpenBulkMarchEditor(){
    if(!state.events.length){showToast('Primero crea una actuación.',true);return;}
    if(!state.repertoire.length){showToast('Primero añade marchas al repertorio.',true);return;}
    const events=state.events.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(a.name||'').localeCompare(b.name||'','es'));
    const marches=state.repertoire.slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
    const evHtml=events.map(ev=>{
      const search=[ev.name,ev.group,ev.locality,ev.date,ev.category].filter(Boolean).join(' ').toLocaleLowerCase('es');
      return `<label class="bmm-bulk-option bmm-bulk-event-option" data-search="${esc(search)}"><input type="checkbox" name="bmmBulkEventIds" value="${esc(ev.id)}"><span class="bmm-bulk-option-main"><strong>${esc(fmtDate(ev.date))} · ${esc(ev.name||'Actuación sin nombre')}</strong><small>${esc(String(ev.group||'').trim()||'Sin grupo')} · ${esc(ev.category||'Otro')} · ${(ev.marches||[]).length} apariciones actuales</small></span></label>`;
    }).join('');
    const marchHtml=marches.map(m=>{
      const search=(m.name+' '+(m.author||'')).toLocaleLowerCase('es');
      return `<div class="bmm-bulk-option bmm-bulk-march-option" data-search="${esc(search)}"><label class="bmm-bulk-march-label"><input type="checkbox" name="bmmBulkMarchIds" value="${esc(m.id)}"><span class="bmm-bulk-option-main"><strong>${esc(m.name)}</strong><small>${esc(m.author||'Autor sin indicar')}</small></span></label><label class="bmm-bulk-qty-label">Veces por actuación<input type="number" name="bmmBulkMarchCount" data-bmm-bulk-count data-march-id="${esc(m.id)}" min="1" max="10" step="1" value="1" aria-label="Cuántas veces añadir ${esc(m.name)} a cada actuación"></label></div>`;
    }).join('');
    const body=`<form id="bmmBulkMarchForm"><p class="bmm-bulk-intro">Selecciona varias actuaciones y una o más marchas. Se añadirán al final de cada actuación elegida. Las marchas existentes se conservan, las repeticiones se permiten y cada aparición puede ajustarse individualmente después.</p><div class="bmm-bulk-grid"><section class="bmm-bulk-panel"><div class="bmm-bulk-panel-head"><h3>1 · Actuaciones destino</h3><span class="pill">${events.length} disponibles</span></div><div class="bmm-bulk-search-tools"><input type="search" id="bmmBulkEventSearch" placeholder="Buscar fecha, actuación o grupo…"><button type="button" class="btn btn-soft btn-small" data-action="bmm-bulk-select-events">Seleccionar visibles</button></div><div class="bmm-bulk-list" id="bmmBulkEventList">${evHtml}</div></section><section class="bmm-bulk-panel"><div class="bmm-bulk-panel-head"><h3>2 · Marchas para añadir</h3><span class="pill">${marches.length} disponibles</span></div><div class="bmm-bulk-search-tools"><input type="search" id="bmmBulkMarchSearch" placeholder="Buscar marcha o autor…"><button type="button" class="btn btn-soft btn-small" data-action="bmm-bulk-select-marches">Seleccionar visibles</button></div><p class="bmm-bulk-help">«Veces por actuación» admite de 1 a 10. Por ejemplo, 2 añade dos apariciones de la misma marcha a cada actuación seleccionada.</p><div class="bmm-bulk-list" id="bmmBulkMarchList">${marchHtml}</div></section></div><p class="bmm-bulk-summary" id="bmmBulkSummary" aria-live="polite">Selecciona las actuaciones y marchas que quieras añadir.</p></form>`;
    openModal('Añadir marchas a varias actuaciones','Edición múltiple · no elimina el repertorio ni las apariciones existentes',body,'<button class="btn btn-soft" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="bmmBulkMarchForm">Añadir a las actuaciones seleccionadas</button>');
    bmmUpdateBulkSummary();
  }
  function bmmBulkFilter(listId,query){
    const list=document.getElementById(listId);if(!list)return;
    const q=String(query||'').trim().toLocaleLowerCase('es');
    list.querySelectorAll('.bmm-bulk-option').forEach(row=>{const show=!q||String(row.dataset.search||'').includes(q);row.classList.toggle('bmm-bulk-hidden',!show);});
  }
  function bmmUpdateBulkSummary(){
    const form=document.getElementById('bmmBulkMarchForm');if(!form)return;
    const events=form.querySelectorAll('input[name="bmmBulkEventIds"]:checked').length;
    const marches=[...form.querySelectorAll('input[name="bmmBulkMarchIds"]:checked')];
    let count=0;marches.forEach(cb=>{const q=[...form.querySelectorAll('[data-bmm-bulk-count]')].find(x=>x.dataset.marchId===cb.value);count+=Math.max(1,Math.min(10,parseInt(q?.value,10)||1));});
    const summary=document.getElementById('bmmBulkSummary');if(summary)summary.textContent=events&&marches.length?`${events} actuaciones seleccionadas · ${marches.length} títulos de marcha · ${count} apariciones nuevas por actuación (${events*count} en total).`:'Selecciona al menos una actuación y una marcha.';
  }
  function bmmSelectVisibleBulk(listId,selector){document.querySelectorAll(`#${listId} .bmm-bulk-option:not(.bmm-bulk-hidden) input[name="${selector}"]`).forEach(cb=>cb.checked=true);bmmUpdateBulkSummary();}

  const bmmRenderActuacionesBeforeV178=renderActuaciones;
  renderActuaciones=function(){
    let html=bmmRenderActuacionesBeforeV178();
    const marker='<button class="btn btn-soft" data-action="preview-filtered-acts-pdf">';
    if(html.includes(marker)) html=html.replace(marker,'<button class="btn btn-soft" data-action="bmm-bulk-march-editor">♫ Añadir marchas a varias actuaciones</button>'+marker);
    return html;
  };

  const bmmHandleActionBeforeV178=handleAction;
  handleAction=function(el){
    const action=el?.dataset?.action;
    if(action==='bmm-bulk-march-editor'){bmmOpenBulkMarchEditor();return;}
    if(action==='bmm-bulk-select-events'){bmmSelectVisibleBulk('bmmBulkEventList','bmmBulkEventIds');return;}
    if(action==='bmm-bulk-select-marches'){bmmSelectVisibleBulk('bmmBulkMarchList','bmmBulkMarchIds');return;}
    if(action==='quick-add-march'){
      const id=el.dataset.id,form=document.getElementById('eventForm'),wrap=document.getElementById('marchRows');
      const march=state.repertoire.find(m=>m.id===id);if(!march||!form||!wrap)return;
      const qtyNode=[...form.querySelectorAll('[data-quick-count]')].find(n=>n.dataset.marchId===id);const qty=Math.max(1,Math.min(10,parseInt(qtyNode?.value,10)||1));
      for(let i=0;i<qty;i++)wrap.insertAdjacentHTML('beforeend',marchRowHtml({marchId:id,order:wrap.querySelectorAll('.march-row').length+1,sourceStop:wrap.querySelectorAll('.march-row').length+1}));
      const cb=[...form.querySelectorAll('input[name="quickMarchIds"]')].find(n=>n.value===id);if(cb)cb.checked=false;
      bmmRefreshMarchOrder();showToast(`${qty} ${qty===1?'aparición añadida':'apariciones añadidas'} de «${march.name}».`);return;
    }
    if(action==='add-march-row'){
      const wrap=document.getElementById('marchRows');if(!wrap)return;
      wrap.insertAdjacentHTML('beforeend',marchRowHtml({order:wrap.querySelectorAll('.march-row').length+1}));bmmRefreshMarchOrder();wrap.lastElementChild?.querySelector('select[name="marchId"]')?.focus();return;
    }
    if(['move-march-up','move-march-down','duplicate-march-row','remove-march-row'].includes(action)){
      const row=el.closest('.march-row'),wrap=document.getElementById('marchRows');if(!row||!wrap)return;
      const rows=()=>[...wrap.querySelectorAll('.march-row')];
      if(action==='move-march-up'){const previous=row.previousElementSibling;if(previous)wrap.insertBefore(row,previous);bmmRefreshMarchOrder();return;}
      if(action==='move-march-down'){const next=row.nextElementSibling;if(next)wrap.insertBefore(next,row);bmmRefreshMarchOrder();return;}
      if(action==='duplicate-march-row'){
        const copy=row.cloneNode(true);const from=[...row.querySelectorAll('[name]')],to=[...copy.querySelectorAll('[name]')];from.forEach((field,index)=>{const target=to[index];if(!target)return;if(field.type==='checkbox'||field.type==='radio')target.checked=field.checked;else target.value=field.value;});
        copy.querySelectorAll('[id^="bmm-field-"]').forEach(field=>field.removeAttribute('id'));
        copy.querySelectorAll('label[for^="bmm-field-"]').forEach(label=>label.removeAttribute('for'));
        row.insertAdjacentElement('afterend',copy);bmmRefreshMarchOrder();copy.querySelector('select[name="marchId"]')?.focus();showToast('Aparición duplicada. Puedes cambiar hora, ubicación y observaciones.');return;
      }
      row.remove();if(!rows().length)wrap.insertAdjacentHTML('beforeend',marchRowHtml({order:1}));bmmRefreshMarchOrder();return;
    }
    return bmmHandleActionBeforeV178(el);
  };

  // The bulk action is transactional from the UI perspective: if local save is blocked, restore the previous events.
  document.addEventListener('submit',function(e){
    const form=e.target;if(form?.id!=='bmmBulkMarchForm')return;
    e.preventDefault();e.stopImmediatePropagation();
    const eventIds=new Set([...form.querySelectorAll('input[name="bmmBulkEventIds"]:checked')].map(cb=>cb.value));
    const chosen=[...form.querySelectorAll('input[name="bmmBulkMarchIds"]:checked')].map(cb=>{
      const march=state.repertoire.find(m=>m.id===cb.value);const countNode=[...form.querySelectorAll('[data-bmm-bulk-count]')].find(n=>n.dataset.marchId===cb.value);
      return march?{marchId:march.id,name:march.name,count:Math.max(1,Math.min(10,parseInt(countNode?.value,10)||1))}:null;
    }).filter(Boolean);
    const targets=state.events.filter(ev=>eventIds.has(ev.id));
    if(!targets.length||!chosen.length){showToast('Selecciona al menos una actuación y una marcha.',true);return;}
    const each=chosen.reduce((n,m)=>n+m.count,0),total=each*targets.length;
    if(!confirm(`Se añadirán ${total} apariciones nuevas en ${targets.length} actuaciones. No se eliminará ni sustituirá ninguna marcha existente. ¿Continuar?`))return;
    const previousEvents=state.events;
    state.events=state.events.map(ev=>{
      if(!eventIds.has(ev.id))return ev;
      const rows=[...(Array.isArray(ev.marches)?ev.marches:[])];let order=rows.reduce((max,p)=>Math.max(max,parseInt(p.order,10)||0),rows.length);
      chosen.forEach(item=>{for(let i=0;i<item.count;i++){order++;rows.push({id:uid('perf'),marchId:item.marchId,sourceTitle:'',sourceStop:order,location:'',order,startTime:'',duration:'',notes:''});}});
      return {...ev,marches:rows};
    });
    const result=save(`Edición múltiple: ${total} apariciones añadidas en ${targets.length} actuaciones`);
    if(result===false){state.events=previousEvents;return;}
    closeModal();setPage('actuaciones');showToast(`${total} apariciones añadidas en ${targets.length} actuaciones.`);
  },true);

  document.addEventListener('input',function(e){
    if(e.target.id==='bmmBulkEventSearch')bmmBulkFilter('bmmBulkEventList',e.target.value);
    if(e.target.id==='bmmBulkMarchSearch')bmmBulkFilter('bmmBulkMarchList',e.target.value);
    if(e.target.matches('#bmmBulkMarchForm input[type="checkbox"],#bmmBulkMarchForm [data-bmm-bulk-count]'))bmmUpdateBulkSummary();
  });
  document.addEventListener('change',function(e){if(e.target.closest('#bmmBulkMarchForm'))bmmUpdateBulkSummary();});

  const styles=document.createElement('style');styles.id='bmm-repeated-marches-style-v178';styles.textContent=`
  .bmm-order-hint{margin:9px 0;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--muted);font-size:12px;line-height:1.5}
  .bmm-order-field{min-width:100px}.bmm-order-pill{display:flex;align-items:center;justify-content:center;min-height:38px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--ink);font-weight:800;font-size:16px}
  .march-row-control:disabled{opacity:.30;cursor:not-allowed;transform:none!important}
  .bmm-quick-march-v178{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;align-items:stretch}
  .bmm-quick-march-label{display:flex;align-items:flex-start;gap:8px;min-width:0;cursor:pointer}.bmm-quick-march-label>span{display:grid;gap:2px;min-width:0}.bmm-quick-march-label small{font-size:10px;color:var(--muted);font-weight:400}
  .bmm-quick-march-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.bmm-quick-march-actions>label{display:flex;align-items:center;gap:7px;font-size:10px;color:var(--muted);font-weight:700}.bmm-quick-march-actions input{width:65px!important;min-width:65px!important;padding:6px 7px!important}.bmm-quick-march-actions .btn{white-space:nowrap}
  .bmm-bulk-intro,.bmm-bulk-help{font-size:12px;color:var(--muted);line-height:1.55;margin:0 0 12px}.bmm-bulk-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.bmm-bulk-panel{min-width:0;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--paper)}.bmm-bulk-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}.bmm-bulk-panel-head h3{font-size:13px;margin:0}.bmm-bulk-search-tools{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}.bmm-bulk-search-tools input{flex:1;min-width:120px;width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 9px;background:var(--paper);color:var(--ink)}.bmm-bulk-search-tools .btn{font-size:10px;padding:7px 8px}.bmm-bulk-list{display:grid;gap:6px;max-height:42vh;overflow:auto;padding:2px}.bmm-bulk-option{display:flex;gap:8px;align-items:flex-start;min-width:0;border:1px solid var(--line);border-radius:9px;padding:9px;background:var(--paper);color:var(--ink)}.bmm-bulk-option input[type=checkbox]{flex-shrink:0;width:17px;height:17px;margin:2px 0 0;accent-color:var(--green)}.bmm-bulk-option-main{display:grid;gap:3px;min-width:0;flex:1}.bmm-bulk-option-main strong{font-size:11px;line-height:1.4;overflow-wrap:anywhere}.bmm-bulk-option-main small{font-size:10px;color:var(--muted);line-height:1.4}.bmm-bulk-event-option{cursor:pointer}.bmm-bulk-march-option{display:grid;grid-template-columns:minmax(0,1fr);gap:7px}.bmm-bulk-march-label{display:flex;gap:8px;min-width:0;cursor:pointer}.bmm-bulk-qty-label{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--muted);font-weight:700}.bmm-bulk-qty-label input{width:66px;min-width:66px;padding:6px 7px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)}.bmm-bulk-hidden{display:none!important}.bmm-bulk-summary{padding:10px 12px;border:1px solid var(--line);border-radius:9px;margin:12px 0 0;font-size:12px;font-weight:700;color:var(--ink);background:var(--paper)}
  html[data-bmm-resolved-theme="dark"] .bmm-order-hint{background:#142019;color:#b5c7bb;border-color:#34483a}html[data-bmm-resolved-theme="dark"] .bmm-order-pill{background:#0b130e;color:#f0f5f1;border-color:#405846}html[data-bmm-resolved-theme="dark"] .bmm-bulk-panel,html[data-bmm-resolved-theme="dark"] .bmm-bulk-option,html[data-bmm-resolved-theme="dark"] .bmm-bulk-summary{background:#142019;color:#edf4ef;border-color:#34483a}html[data-bmm-resolved-theme="dark"] .bmm-bulk-search-tools input,html[data-bmm-resolved-theme="dark"] .bmm-bulk-qty-label input{background:#0b130e;color:#f0f5f1;border-color:#405846}html[data-bmm-resolved-theme="dark"] .bmm-quick-march-actions input{background:#0b130e;color:#f0f5f1;border-color:#405846}
  @media(max-width:760px){.bmm-bulk-grid{grid-template-columns:1fr}.bmm-bulk-list{max-height:30vh}.bmm-quick-march-actions{justify-content:flex-start}.bmm-quick-march-actions .btn{flex:1}.bmm-bulk-search-tools .btn{flex:1}.bmm-order-field{min-width:80px}}
  `;document.head.appendChild(styles);
  if(typeof render==='function')render();
})();
