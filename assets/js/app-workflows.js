// BMM Santa Cecilia: analítica, cronología, grupos y centro de informes.
(() => {
  const bmmBaseNormalize = normalize;
  const bmmBaseEventForm = eventForm;
  const bmmBaseMarchForm = marchForm;
  const bmmBaseHandleAction = handleAction;
  const bmmBaseRender = render;
  let bmmTimelineSearch = '', bmmTimelineYear = 'all', bmmTimelineGroup = 'all', bmmTimelineType = 'all';
  let bmmAnalyticsYear = 'all', bmmAnalyticsMetric = 'plays';
  let bmmGroupSearch = '', bmmEditingGroup = null;
  let bmmReportType = 'events', bmmReportTitle = 'Informe de actuaciones';
  let bmmReportOrientation = 'portrait', bmmReportIncludeAuthors = true, bmmReportIncludeNotes = true, bmmReportIncludeStats = true, bmmReportIncludeDateInTitle = false;
  function bmmReportOutputTitle(title){const base=String(title||bmmReportTitle||bmmReportTitleFor(bmmReportType)).trim();if(!bmmReportIncludeDateInTitle)return base;const d=new Date();const stamp=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return base.replace(/\s*[·–-]\s*\d{4}-\d{2}-\d{2}$/,'')+' · '+stamp;}
  let bmmPreviewState = null;
  let bmmScopedMarchIds = null, bmmScopedGroupIds = null, bmmScopedEventIds = null, bmmScopedAnalysisEventIds = null;
  let bmmScopeDescription = '';
  const bmmPageNames = {dashboard:'Resumen ejecutivo',actuaciones:'Actuaciones y calendario',calendario:'Calendario de la banda',cronologia:'Cronología de la banda',repertorio:'Repertorio musical',analitica:'Analítica musical',grupos:'Grupos de eventos',integrantes:'Integrantes de la banda',informes:'Centro de informes',configuracion:'Ajustes y datos'};
  const bmmDefaultGroups = [
    {name:'Semana Santa', description:'Procesiones y traslados de Semana Santa', color:'#236b45'},
    {name:'Fiestas patronales', description:'Actos y procesiones patronales', color:'#b99a3c'},
    {name:'Conciertos', description:'Conciertos y audiciones', color:'#3b7d90'},
    {name:'Certámenes', description:'Certámenes y encuentros musicales', color:'#8d6a9d'},
    {name:'Navidad', description:'Actos de Navidad', color:'#b86a4f'}
  ];
  const bmmColors = ['#236b45','#c0a04c','#397f91','#896aa0','#b66b4f','#5b7bba','#8c9660'];
  // Deterministic fallback IDs keep legacy records without IDs identical when
  // they are normalized independently on two devices or during a cloud read.
  // Existing IDs are never replaced.
  function bmmStableId(prefix, value){
    const text=JSON.stringify(value??'');let h1=2166136261,h2=0x9e3779b9;
    for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);h1^=c;h1=Math.imul(h1,16777619);h2^=c+i;h2=Math.imul(h2,2246822519);}
    return `bmm-${prefix}-${(h1>>>0).toString(36)}${(h2>>>0).toString(36)}`;
  }
  const bmmUniq = arr => [...new Set(arr.map(x=>String(x||'').trim()).filter(Boolean))];
  const bmmCountBy = (items, keyFn) => { const m={}; items.forEach(x=>{const k=keyFn(x)||'Sin clasificar';m[k]=(m[k]||0)+1});return m; };
  const bmmFormatNum = n => Number(n||0).toLocaleString('es-ES');
  const bmmSafeName = s => String(s||'informe').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'informe';
  const bmmInitials = s => String(s||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
  const bmmCurrentYear = () => String(new Date().getFullYear());
  const bmmDate = value => {if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;const date=new Date(value+'T12:00:00');return Number.isFinite(date.getTime())&&[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')===value?date:null;};
  const bmmTodayKey = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const bmmStatusIsCancelled = status => /^cancelad/i.test(String(status||'').trim());
  const bmmStatusIsCompleted = status => /^(realizado|finalizado|finalizada|completado|completada|terminado|terminada)$/i.test(String(status||'').trim());
  // The calendar date is authoritative once the whole event day has passed.
  // Cancellation is always preserved; manually completed events remain completed even if future-dated.
  const bmmEffectiveEventStatus = (date,status) => {
    const current=String(status||'').trim();
    if(bmmStatusIsCancelled(current))return 'Cancelado';
    if(date && String(date)<bmmTodayKey())return 'Realizado';
    if(bmmStatusIsCompleted(current))return 'Realizado';
    return current||'Planificado';
  };
  const bmmStatus = e => bmmEffectiveEventStatus(e?.date,e?.status);
  const bmmIsPast = e => !!e.date && e.date < bmmTodayKey();
  const bmmCountOverdueIncomplete = (events,today=bmmTodayKey()) => (Array.isArray(events)?events:[]).filter(e=>e&&e.date&&String(e.date)<today&&!bmmStatusIsCancelled(e.status)&&!bmmStatusIsCompleted(e.status)).length;
  let bmmCloudAutoCompletionPending = 0;
  // True only when this device has unsynced edits based on the exact same cloud revision.
  // In that case we can safely rebase on the freshly-read ETag and sync without a false conflict.
  let bmmCloudStartupSyncNeeded = false;
  const bmmYear = e => (e.date||'').slice(0,4) || 'Sin año';
  const bmmGroup = e => String(e.group||'').trim() || 'Sin grupo';
  const bmmMarchName = p => getMarch(p.marchId)?.name || 'Marcha eliminada';

  normalize = function(x) {
    const v = bmmBaseNormalize(x || {});
    v.version = 3;
    v.repertoire = (Array.isArray(x?.repertoire) ? x.repertoire : v.repertoire).filter(m=>m&&typeof m==='object').map((m,mIndex)=>({
      id:String(m.id||bmmStableId('march',[m.name||m.title||'',m.author||m.composer||'',mIndex])), name:String(m.name||'Marcha sin título'), author:String(m.author||m.composer||''), style:String(m.style||m.type||''),
      genre:String(m.genre||''), season:String(m.season||''), difficulty:String(m.difficulty||''), yearComposed:String(m.yearComposed||''), publisher:String(m.publisher||''), notes:String(m.notes||''), tags:Array.isArray(m.tags)?m.tags:[]
    }));
    v.events = (Array.isArray(x?.events)?x.events:v.events).filter(e=>e&&typeof e==='object').map((e,eIndex)=>({
      ...e, id:String(e.id||bmmStableId('event',[e.date||'',e.time||'',e.name||'',e.group||'',e.category||'',e.locality||'',eIndex])), date:String(e.date||''), time:String(e.time||''), name:String(e.name||'Actuación sin título'),
      group:String(e.group||''), category:String(e.category||'Otro'), locality:String(e.locality||''), notes:String(e.notes||''), status:bmmEffectiveEventStatus(String(e.date||''),e.status),
      organizer:String(e.organizer||''), route:String(e.route||''), duration:String(e.duration||''), startPlace:String(e.startPlace||''), endPlace:String(e.endPlace||''), tags:Array.isArray(e.tags)?e.tags:[],
      marches:(Array.isArray(e.marches)?e.marches:[]).filter(p=>p&&typeof p==='object').map((p,i)=>({...p,id:String(p.id||bmmStableId('perf',[p.marchId||p.sourceTitle||'',Number(p.order)||i+1,p.location||'',p.startTime||'',i])),marchId:String(p.marchId||''),location:String(p.location||''),order:Number(p.order)||i+1,notes:String(p.notes||''),startTime:String(p.startTime||''),duration:String(p.duration||'')}))
    }));
    v.categories = bmmUniq([...(Array.isArray(x?.categories)?x.categories:v.categories||[]),'Procesión','Traslado','Pasacalles','Concierto','Certamen','Otro']);
    const oldGroups = v.events.map(e=>e.group).filter(Boolean);
    const storedGroups = Array.isArray(x?.groupsCatalog)?x.groupsCatalog:[];
    const byName = new Map();
    [...bmmDefaultGroups, ...storedGroups, ...bmmUniq(oldGroups).map((name,i)=>({name,description:'Grupo importado de las actuaciones',color:bmmColors[i%bmmColors.length]}))].forEach((g,i)=>{
      const name=String(g.name||'').trim();if(!name)return;const k=name.toLocaleLowerCase('es');const old=byName.get(k);byName.set(k,{id:String(g.id||old?.id||bmmStableId('group',name.toLocaleLowerCase('es'))),name,description:String(g.description||old?.description||''),color:String(g.color||old?.color||bmmColors[i%bmmColors.length])});
    });
    v.groupsCatalog=[...byName.values()];
    v.settings={...(x?.settings||{}), organization:'BMM Santa Cecilia de Arjonilla',theme:'forest-gold', ...((x?.settings)||{})};
    v.members=(Array.isArray(x?.members)?x.members:[]).filter(m=>m&&typeof m==='object').map((m,mIndex)=>({
      id:String(m.id||bmmStableId('member',[m.name||'',m.instrument||'',m.registrationYear||m.enrollmentYear||'',m.email||'',mIndex])),name:String(m.name||'Integrante sin nombre'),instrument:String(m.instrument||''),registrationYear:String(m.registrationYear||m.enrollmentYear||''),
      section:String(m.section||''),role:String(m.role||''),status:String(m.status||'Activo'),email:String(m.email||''),phone:String(m.phone||''),notes:String(m.notes||''),tags:Array.isArray(m.tags)?m.tags:[]
    }));
    v.auditLog=Array.isArray(x?.auditLog)?x.auditLog.slice(0,1500):[];
    return v;
  };
  state = normalize(state);
  if(!bmmHasUnresolvedLocalRecovery()){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch(e) { /* Almacenamiento no disponible: se mantiene el estado de sesión. */ }
  }

  // Identidad y navegación: un único menú lateral desplegable en móvil.
  document.title = 'BMM Santa Cecilia de Arjonilla';
  const nav = document.getElementById('nav');
  const bmmNavItems = [
    ['dashboard','◈','Resumen'],['actuaciones','♫','Actuaciones'],['calendario','▦','Calendario'],['cronologia','↗','Cronología'],['repertorio','▤','Repertorio'],
    ['analitica','▥','Analítica'],['grupos','▦','Grupos'],['integrantes','♙','Integrantes'],['informes','▧','Informes'],['configuracion','⚙','Ajustes']
  ];
  if (nav) {
    nav.innerHTML = bmmNavItems.map(([key,icon,label])=>`<button data-page="${esc(key)}" class="${page===key?'active':''}"><span class="nav-icon">${icon}</span><span class="nav-label-text">${label}</span></button>`).join('');
    const drawerBackdrop=document.createElement('div');
    drawerBackdrop.className='bmm-drawer-backdrop';drawerBackdrop.id='bmmDrawerBackdrop';drawerBackdrop.setAttribute('aria-hidden','true');
    document.body.appendChild(drawerBackdrop);
    const drawerToggle=document.getElementById('bmmDrawerToggle');
    const sidebar=document.querySelector('.sidebar'),content=document.getElementById('content'),topbar=document.querySelector('.topbar');
    const compact=window.matchMedia('(max-width: 1199px)');
    sidebar.id='bmmSidebar';drawerToggle?.setAttribute('aria-controls',sidebar.id);
    const drawerClose=document.createElement('button');
    drawerClose.type='button';drawerClose.className='bmm-drawer-close';drawerClose.setAttribute('aria-label','Cerrar menú');drawerClose.setAttribute('aria-controls',sidebar.id);drawerClose.textContent='× Cerrar menú';sidebar.prepend(drawerClose);
    const closeDrawer=(restoreFocus=true)=>{
      const wasOpen=document.body.classList.contains('bmm-drawer-open');
      document.body.classList.remove('bmm-drawer-open');drawerBackdrop.classList.remove('open');drawerBackdrop.setAttribute('aria-hidden','true');
      drawerToggle?.setAttribute('aria-expanded','false');drawerToggle?.setAttribute('aria-label','Abrir menú');
      sidebar.inert=compact.matches;content.inert=false;topbar.inert=false;document.querySelector('.bmm-floating-save')?.removeAttribute('inert');bmmUnlockScroll('drawer');
      if(wasOpen&&restoreFocus&&compact.matches)drawerToggle?.focus({preventScroll:true});
    };
    const openDrawer=()=>{
      if(!compact.matches)return;
      document.body.classList.add('bmm-drawer-open');drawerBackdrop.classList.add('open');drawerBackdrop.setAttribute('aria-hidden','false');
      drawerToggle?.setAttribute('aria-expanded','true');drawerToggle?.setAttribute('aria-label','Cerrar menú');
      sidebar.inert=false;content.inert=true;topbar.inert=true;document.querySelector('.bmm-floating-save')?.setAttribute('inert','');bmmLockScroll('drawer');
      (nav.querySelector('.active')||nav.querySelector('button'))?.focus({preventScroll:true});
    };
    drawerToggle?.addEventListener('click',()=>document.body.classList.contains('bmm-drawer-open')?closeDrawer():openDrawer());
    drawerClose.addEventListener('click',()=>closeDrawer());
    drawerBackdrop.addEventListener('click',()=>closeDrawer());
    document.addEventListener('click',event=>{if(event.target.closest?.('[data-page]'))closeDrawer();},true);
    document.addEventListener('keydown',event=>{
      if(!document.body.classList.contains('bmm-drawer-open'))return;
      if(event.key==='Escape'){event.preventDefault();closeDrawer();return;}
      if(event.key!=='Tab')return;
      const controls=bmmFocusable(sidebar),first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    compact.addEventListener('change',()=>closeDrawer(false));
    closeDrawer(false);
    window.bmmCloseDrawer=closeDrawer;
    window.bmmSyncCompactNav=function(){nav.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));};
  }
  const brandName=document.querySelector('.brand-name'); if(brandName)brandName.textContent='BMM Santa Cecilia';
  const bottom=document.querySelector('.sidebar-bottom'); if(bottom)bottom.innerHTML='<div><span class="status-dot"></span>Guardado en este dispositivo</div><div style="margin-top:9px">BMM Santa Cecilia · Analítica local</div>';

  function bmmPerf(events=state.events){return allPlays(events).sort((a,b)=>(a.event.date||'').localeCompare(b.event.date||'')||(a.event.time||'').localeCompare(b.event.time||'')||(+a.order||0)-(+b.order||0));}
  function bmmIndexPlays(performances){const index=new Map();performances.forEach(performance=>{const id=performance.march.id;if(!index.has(id))index.set(id,[]);index.get(id).push(performance);});return index;}
  function bmmMonthKey(date){return (date||'').slice(0,7);}
  function bmmMonths(events) {
    const counts={};events.forEach(event=>{if(bmmDate(event.date)){const key=event.date.slice(0,7);counts[key]=(counts[key]||0)+1}});
    const keys=Object.keys(counts).sort();
    if(!keys.length)return [];
    const last=keys[keys.length-1];const d=new Date(last+'-15T12:00:00');const out=[];
    for(let i=11;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);const k=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`;out.push({key:k,label:new Intl.DateTimeFormat('es-ES',{month:'short'}).format(x).replace('.',''),count:counts[k]||0})}
    return out;
  }
  function bmmBarChart(items,{value='count',label='label',max}={}){
    if(!items.length)return '<div class="chart-empty">Todavía no hay datos suficientes para mostrar este gráfico.</div>';
    const cap=max||Math.max(1,...items.map(x=>Number(x[value]||0)));
    return `<div class="bar-chart">${items.map(x=>`<div class="bar-item"><div class="bar-label" title="${esc(x[label]||'Sin nombre')}">${esc(x[label]||'Sin nombre')}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,Number(x[value]||0)/cap*100))}%"></div></div><div class="bar-value">${bmmFormatNum(x[value])}</div></div>`).join('')}</div>`;
  }
  function bmmMiniChart(items){
    if(!items.length)return '<div class="chart-empty">Sin datos temporales todavía.</div>';
    const max=Math.max(1,...items.map(x=>x.count));
    return `<div class="mini-chart">${items.map(x=>`<div class="mini-bar-col"><span class="mini-bar-count">${x.count||''}</span><div class="mini-bar" title="${esc(x.key)}: ${x.count}" style="height:${Math.max(3,(x.count/max)*100)}%"></div><span class="mini-bar-label">${esc(x.label)}</span></div>`).join('')}</div>`;
  }
  function bmmProKpi(icon,label,value,meta,tint='#e4eee1'){
    return `<article class="pro-card pro-kpi" style="--tint:${tint}"><div class="pro-kpi-label"><span class="kpi-symbol">${icon}</span>${esc(label)}</div><div class="pro-kpi-value">${esc(String(value))}</div><div class="pro-kpi-meta">${esc(meta||'')}</div></article>`;
  }
  function bmmHeader(eyebrow,title,description,buttons=''){
    return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="toolbar">${buttons}</div></div>`;
  }
  function bmmDocKpis(events){const plays=totalPlays(events);return `<div class="report-doc-kpis"><div class="report-doc-kpi"><strong>${events.length}</strong><span>Actuaciones incluidas</span></div><div class="report-doc-kpi"><strong>${plays}</strong><span>Interpretaciones</span></div><div class="report-doc-kpi"><strong>${new Set(allPlays(events).map(p=>p.march.id)).size}</strong><span>Marchas distintas</span></div><div class="report-doc-kpi"><strong>${new Set(events.map(bmmGroup)).size}</strong><span>Grupos representados</span></div></div>`;}

  renderDashboard = function(){
    const ev=[...state.events].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
    const plays=bmmPerf(ev);const c=counts(ev);const marchPlayed=Object.keys(c).length;const noPlays=ev.filter(e=>!(e.marches||[]).length).length;
    const top=state.repertoire.map(m=>({...m,count:c[m.id]||0})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es')).slice(0,7);
    const authorCounts=bmmCountBy(plays,p=>p.march.author||'Autor sin indicar');const authors=Object.entries(authorCounts).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,5);
    const groupCounts=bmmCountBy(ev,bmmGroup);const groups=Object.entries(groupCounts).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,5);
    const today=bmmTodayKey();const next=ev.filter(e=>(e.date||'')>=today&&bmmStatus(e)!=='Cancelado').sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''))[0];
    const recent=ev.filter(e=>e.date<=today).slice(-5).reverse();const recentUpcoming=ev.filter(e=>e.date>today).slice(0,3);
    const monthly=bmmMonths(ev);const groupsCount=new Set(ev.map(bmmGroup)).size;const avg=ev.length?(plays.length/ev.length).toFixed(1).replace('.',','):'0';
    const insights=[];
    if(top[0]?.count)insights.push({icon:'♫',title:`Marcha más interpretada: ${top[0].name}`,text:`Aparece ${top[0].count} veces en el registro. El ranking se calcula desde las actuaciones guardadas.`});
    if(noPlays)insights.push({icon:'!',title:`${noPlays} actuación${noPlays===1?'':'es'} sin marchas registradas`,text:'Puedes localizarlas en Actuaciones y completar las interpretaciones pendientes.'});
    if(next)insights.push({icon:'↗',title:`Próxima actuación: ${next.name}`,text:`${fmtDate(next.date)}${next.time?' · '+next.time:''} · ${bmmGroup(next)}.`});
    if(!insights.length)insights.push({icon:'✓',title:'Registro al día',text:'Cuando registres nuevas actuaciones, los indicadores se actualizarán automáticamente.'});
    return `${bmmHeader('Panel ejecutivo','BMM Santa Cecilia de Arjonilla','Centro de control musical: actividad de la banda, repertorio, interpretaciones y próximos compromisos.',`<button class="btn btn-soft" data-action="preview-section-pdf" data-report-type="full">▧ Informe completo</button><button class="btn btn-primary" data-action="add-event">＋ Nueva actuación</button>`)}
      <section class="pro-hero"><div class="eyebrow">Cuadro de mando · Gestión musical</div><h1>La actividad de la banda,<br>en una sola vista.</h1><p>Un registro vivo de cada procesión, evento y marcha interpretada, con indicadores para preparar informes claros y entregar datos a la dirección.</p><div class="hero-kpis"><div class="hero-kpi"><strong>${bmmFormatNum(ev.length)}</strong><span>Eventos registrados</span></div><div class="hero-kpi"><strong>${bmmFormatNum(plays.length)}</strong><span>Interpretaciones</span></div><div class="hero-kpi"><strong>${bmmFormatNum(state.repertoire.length)}</strong><span>Marchas en catálogo</span></div><div class="hero-kpi"><strong>${bmmFormatNum(groupsCount)}</strong><span>Grupos de eventos</span></div><div class="hero-kpi"><strong>${bmmFormatNum((state.members||[]).length)}</strong><span>Integrantes</span></div></div></section>
      <section class="pro-grid">
        <div class="span-3">${bmmProKpi('♫','Marchas con historial',marchPlayed,`${Math.round(marchPlayed/Math.max(1,state.repertoire.length)*100)}% del repertorio con al menos una interpretación`)}</div>
        <div class="span-3">${bmmProKpi('◎','Media por actuación',avg,'Interpretaciones medias por evento','#e3edf2')}</div>
        <div class="span-3">${bmmProKpi('◷','Sin marchas anotadas',noPlays,'Actuaciones que conviene completar','#f7edcf')}</div>
        <div class="span-3">${bmmProKpi('♙','Autores identificados',bmmUniq(state.repertoire.map(m=>m.author)).filter(x=>x!=='').length,'Compositores presentes en el repertorio','#eee6f2')}</div>
        <section class="pro-card span-7"><div class="pro-card-head"><div><h2>Actividad mensual</h2><p>Eventos registrados durante los últimos 12 meses con actividad</p></div><button class="btn btn-soft btn-small" data-page="analitica">Explorar ↗</button></div><div class="pro-card-body">${bmmMiniChart(monthly)}</div></section>
        <section class="pro-card span-5"><div class="pro-card-head"><div><h2>Marchas más interpretadas</h2><p>Ranking calculado automáticamente</p></div><button class="btn btn-soft btn-small" data-page="repertorio">Repertorio ↗</button></div><div class="pro-card-body">${bmmBarChart(top.map(m=>({label:m.name,count:m.count})))}</div></section>
        <section class="pro-card span-5"><div class="pro-card-head"><div><h2>Eventos por grupo</h2><p>Distribución de la actividad por campañas</p></div><button class="btn btn-soft btn-small" data-page="grupos">Ver grupos ↗</button></div><div class="pro-card-body">${bmmBarChart(groups)}</div></section>
        <section class="pro-card span-7"><div class="pro-card-head"><div><h2>Próxima actuación</h2><p>Compromiso más cercano pendiente de realizar</p></div><button class="btn btn-soft btn-small" data-page="calendario">Ver calendario ↗</button></div><div class="pro-card-body">${next?`${eventPreview(next)}<div class="section-toolbar" style="margin-top:12px"><span class="pill gold">${bmmGroup(next)}</span><span class="pill">${(next.marches||[]).length} marchas anotadas</span><button class="btn btn-soft btn-small" data-action="edit-event" data-id="${esc(next.id)}">Editar ficha</button></div>`:'<div class="chart-empty">No hay actuaciones futuras. Puedes crear una con el botón «Nueva actuación».</div>'}</div></section>
        <section class="pro-card span-6"><div class="pro-card-head"><div><h2>Actividad reciente</h2><p>Últimos eventos en el histórico</p></div><button class="btn btn-soft btn-small" data-page="cronologia">Abrir cronología ↗</button></div><div class="pro-card-body"><div class="event-list">${recent.length?recent.map(eventPreview).join(''):'<div class="chart-empty">Aún no hay actuaciones pasadas.</div>'}</div></div></section>
        <section class="pro-card span-6"><div class="pro-card-head"><div><h2>Lecturas del registro</h2><p>Alertas y hallazgos para mantener la información completa</p></div><span class="pill gold">Insights</span></div><div class="pro-card-body">${insights.map(i=>`<div class="insight-row"><div class="insight-icon">${i.icon}</div><div><strong>${esc(i.title)}</strong><span>${esc(i.text)}</span></div></div>`).join('')}</div></section>
        <section class="pro-card span-12"><div class="pro-card-head"><div><h2>Accesos rápidos</h2><p>Las tareas habituales en un solo toque</p></div></div><div class="pro-card-body"><div class="quick-action-grid"><button class="quick-action" data-action="add-event"><span class="qa-icon">＋</span><span><strong>Registrar actuación</strong><span>Nueva procesión, concierto o evento</span></span></button><button class="quick-action" data-action="add-march"><span class="qa-icon">♫</span><span><strong>Añadir marcha</strong><span>Ampliar el repertorio</span></span></button><button class="quick-action" data-page="informes"><span class="qa-icon">▧</span><span><strong>Preparar informe</strong><span>Filtrar, previsualizar y exportar</span></span></button></div></div></section>
      </section>`;
  };

  function bmmTimelineEvents(){
    const q=bmmTimelineSearch.trim().toLocaleLowerCase('es');
    return [...state.events].filter(e=>{
      const hay=[e.name,e.group,e.category,e.locality,e.notes,e.organizer,e.route,...(e.tags||[]),...(e.marches||[]).map(p=>`${bmmMarchName(p)} ${p.notes} ${p.location}`)].join(' ').toLocaleLowerCase('es');
      return (!q||hay.includes(q))&&(bmmTimelineYear==='all'||bmmYear(e)===bmmTimelineYear)&&(bmmTimelineGroup==='all'||bmmGroup(e)===bmmTimelineGroup)&&(bmmTimelineType==='all'||e.category===bmmTimelineType);
    }).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
  }
  renderTimeline = function(){
    const events=bmmTimelineEvents();const years=bmmUniq(events.map(bmmYear)).sort().reverse();const completed=events.filter(e=>bmmStatus(e)==='Realizado').length;const planned=events.filter(e=>bmmStatus(e)==='Planificado').length;const allP=totalPlays(events);const groups=bmmUniq(state.events.map(bmmGroup)).sort((a,b)=>a.localeCompare(b,'es'));
    const byYear=years.map(y=>`<div class="timeline-year">${esc(y)} · ${events.filter(e=>bmmYear(e)===y).length} eventos</div>${events.filter(e=>bmmYear(e)===y).map(e=>{
      const ps=(e.marches||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0));const status=bmmStatus(e);const d=bmmDate(e.date);const month=d?new Intl.DateTimeFormat('es-ES',{month:'short'}).format(d).replace('.',''):'s/f';
      return `<article class="timeline-item ${bmmIsPast(e)?'past':'future'}"><div class="timeline-event-top"><div class="timeline-date"><strong>${d?d.getDate():'—'}</strong><span>${esc(month)}${e.time?' · '+esc(e.time):''}</span></div><div class="timeline-info"><h3>${esc(e.name)}</h3><div class="timeline-meta"><span>▦ ${esc(bmmGroup(e))}</span><span>· ${esc(e.category||'Otro')}</span>${e.locality?`<span>⌖ ${esc(e.locality)}</span>`:''}${e.organizer?`<span>Organiza: ${esc(e.organizer)}</span>`:''}</div><div class="timeline-meta" style="margin-top:7px"><span class="status-badge status-${bmmSafeName(status)}">${esc(status)}</span><span>${ps.length} interpretaciones registradas</span><span>${e.duration?esc(e.duration)+' min':''}</span></div></div><div class="actions"><button class="icon-btn" title="Editar evento" data-action="edit-event" data-id="${esc(e.id)}">✎</button></div></div>${ps.length?`<div class="timeline-marches">${ps.map((p,i)=>`<span class="timeline-march" title="${esc([p.location,p.notes].filter(Boolean).join(' · '))}"><b>${esc(p.order||i+1)}</b>${esc(bmmMarchName(p))}${p.location?` · ${esc(p.location)}`:''}</span>`).join('')}</div>`:'<div class="timeline-marches"><span class="no-data-pill">Sin marchas anotadas</span><button class="btn btn-soft btn-small" data-action="edit-event" data-id="${esc(e.id)}">Completar registro</button></div>'}${e.notes?`<p style="margin:12px 0 0;color:#728177;font-size:11px">${esc(e.notes)}</p>`:''}</article>`;
    }).join('')}`).join('');
    return `${bmmHeader('Histórico y planificación','Cronología de la banda','Línea temporal de procesiones, conciertos y eventos, con la secuencia de marchas anotadas en cada actuación.',`<button class="btn btn-soft" data-action="preview-section-pdf" data-report-type="timeline">▧ PDF cronológico</button><button class="btn btn-primary" data-action="add-event">＋ Nuevo evento</button>`)}
      <div class="pro-grid" style="margin-bottom:18px"><div class="span-3">${bmmProKpi('◷','Eventos visibles',events.length,'Según los filtros actuales')}</div><div class="span-3">${bmmProKpi('✓','Realizados',completed,'Estado del evento','#e1efe2')}</div><div class="span-3">${bmmProKpi('↗','Planificados',planned,'Pendientes en el calendario','#fbf0d0')}</div><div class="span-3">${bmmProKpi('♫','Marchas registradas',allP,'En los eventos visibles','#e3edf2')}</div></div>
      <section class="filter-panel"><div class="field"><label>Buscar en el histórico</label><input id="timelineSearch" type="search" value="${esc(bmmTimelineSearch)}" placeholder="Evento, marcha, nota…"></div><div class="field"><label>Año</label><select id="timelineYear"><option value="all">Todos los años</option>${bmmUniq(state.events.map(bmmYear)).sort().reverse().map(y=>`<option value="${esc(y)}" ${bmmTimelineYear===y?'selected':''}>${esc(y)}</option>`).join('')}</select></div><div class="field"><label>Grupo</label><select id="timelineGroup"><option value="all">Todos los grupos</option>${groups.map(g=>`<option value="${esc(g)}" ${bmmTimelineGroup===g?'selected':''}>${esc(g)}</option>`).join('')}</select></div><div class="field"><label>Tipo de evento</label><select id="timelineType"><option value="all">Todos los tipos</option>${state.categories.map(c=>`<option value="${esc(c)}" ${bmmTimelineType===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div></section>
      <div class="section-toolbar"><span class="pill">${events.length} resultados</span><span class="pill gold">${allP} interpretaciones</span><span class="spacer"></span><button class="btn btn-soft btn-small" data-action="timeline-clear">Limpiar filtros</button><button class="btn btn-soft btn-small" data-action="export-timeline-csv">Exportar CSV</button></div>
      ${events.length?`<div class="timeline">${byYear}</div>`:'<div class="chart-empty">No hay eventos para los filtros seleccionados. Cambia los criterios o crea una nueva actuación.</div>'}`;
  };

  renderAnalytics = function(){
    const ev=state.events.filter(e=>bmmAnalyticsYear==='all'||bmmYear(e)===bmmAnalyticsYear);const plays=bmmPerf(ev);const c=counts(ev);const yearOptions=bmmUniq(state.events.map(bmmYear)).sort().reverse();
    const appearancesByMarch=bmmIndexPlays(plays);
    const marchStats=state.repertoire.map(m=>{const appearances=(appearancesByMarch.get(m.id)||[]).slice().sort((a,b)=>(b.event.date||'').localeCompare(a.event.date||'')||(b.event.time||'').localeCompare(a.event.time||''));return {...m,count:c[m.id]||0,events:new Set(appearances.map(p=>p.event.id)).size,lastEvent:appearances[0]?.event||null,firstEvent:appearances.at(-1)?.event||null};}).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es'));
    const played=marchStats.filter(m=>m.count>0).length;const never=marchStats.filter(m=>m.count===0);const top=[...marchStats].filter(m=>m.count>0).slice(0,10);const bottom=[...marchStats].filter(m=>m.count>0).slice(-7).reverse();
    const authors=Object.entries(bmmCountBy(plays,p=>p.march.author||'Autor sin indicar')).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,8);
    const groupPerf=Object.entries(bmmCountBy(ev,bmmGroup)).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,8);
    const categories=Object.entries(bmmCountBy(ev,e=>e.category)).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);
    const monthly=bmmMonths(ev);const eventsWithMarch=ev.filter(e=>(e.marches||[]).length).length;const avg=ev.length?(plays.length/ev.length).toFixed(2).replace('.',','):'0';const eventsWithoutMarch=ev.length-eventsWithMarch;const periodLabel=bmmAnalyticsYear==='all'?'todo el histórico':bmmAnalyticsYear;
    const topName=top[0]?.name||'Sin datos';const topCount=top[0]?.count||0;const share=Math.round(played/Math.max(1,state.repertoire.length)*100);
    return `${bmmHeader('Inteligencia musical','Analítica e indicadores','Explora frecuencia de interpretación, concentración del repertorio, actividad por grupo y hábitos de programación. Los recuentos se derivan del histórico, no de valores introducidos a mano.',`<button class="btn btn-soft" data-action="preview-section-pdf" data-report-type="analytics">▧ PDF analítico</button><button class="btn btn-soft" data-action="export-analytics-csv">⇩ Datos CSV</button>`)}
      <section class="filter-panel"><div class="field"><label>Periodo analizado</label><select id="analyticsYear"><option value="all" ${bmmAnalyticsYear==='all'?'selected':''}>Todo el histórico</option>${yearOptions.map(y=>`<option value="${esc(y)}" ${bmmAnalyticsYear===y?'selected':''}>${esc(y)}</option>`).join('')}</select></div><div class="field"><label>Indicador principal</label><select id="analyticsMetric"><option value="plays" ${bmmAnalyticsMetric==='plays'?'selected':''}>N.º de interpretaciones</option><option value="events" ${bmmAnalyticsMetric==='events'?'selected':''}>N.º de actuaciones distintas</option></select></div><div class="field" style="justify-content:flex-end;display:flex;align-items:flex-end"><span class="pill gold">Periodo: ${esc(periodLabel)}</span></div><div class="field" style="justify-content:flex-end;display:flex;align-items:flex-end"><button class="btn btn-soft btn-small" data-action="analytics-reset">Restablecer</button></div></section>
      <div class="pro-grid">
        <div class="span-3">${bmmProKpi('♫','Interpretaciones',bmmFormatNum(plays.length),'En el periodo seleccionado')}</div><div class="span-3">${bmmProKpi('◉','Marchas utilizadas',bmmFormatNum(played),`${share}% del catálogo ha sonado`)}</div><div class="span-3">${bmmProKpi('↗','Media por evento',avg,'Marchas registradas / actuaciones','#e3edf2')}</div><div class="span-3">${bmmProKpi('◷','Sin interpretar',bmmFormatNum(never.length),'Marchas sin apariciones en el periodo','#fbf0d0')}</div><div class="span-3">${bmmProKpi('!', 'Actuaciones sin marchas',bmmFormatNum(eventsWithoutMarch),'Eventos que necesitan completar repertorio','#fbf0d0')}</div>
        <section class="pro-card span-7"><div class="pro-card-head"><div><h2>Top de marchas</h2><p>Frecuencia absoluta en el registro de interpretaciones</p></div><span class="pill gold">${top.length} primeras</span></div><div class="pro-card-body">${bmmBarChart(top.map(m=>({label:m.name,count:bmmAnalyticsMetric==='events'?m.events:m.count})))}</div></section>
        <section class="pro-card span-5"><div class="pro-card-head"><div><h2>Actuaciones por grupo</h2><p>Qué grupos concentran más eventos</p></div></div><div class="pro-card-body">${bmmBarChart(groupPerf)}</div></section>
        <section class="pro-card span-6"><div class="pro-card-head"><div><h2>Evolución mensual</h2><p>Actuaciones por mes en el periodo consultado</p></div></div><div class="pro-card-body">${bmmMiniChart(monthly)}</div></section>
        <section class="pro-card span-6"><div class="pro-card-head"><div><h2>Actividad por categoría</h2><p>Distribución de las actuaciones según su tipo</p></div></div><div class="pro-card-body">${bmmBarChart(categories)}</div></section>
        <section class="pro-card span-6"><div class="pro-card-head"><div><h2>Autores con más interpretaciones</h2><p>Agrupación por autor presente en las piezas interpretadas</p></div></div><div class="pro-card-body">${authors.length?authors.map(a=>`<div class="author-row"><span class="author-avatar">${esc(bmmInitials(a.label))}</span><div class="author-meta"><strong>${esc(a.label)}</strong><span>${a.count} interpretaciones</span></div><span class="author-count">${a.count}</span></div>`).join(''):'<div class="chart-empty">Todavía no hay interpretaciones.</div>'}</div></section>
        <section class="pro-card span-6"><div class="pro-card-head"><div><h2>Menos interpretadas</h2><p>Marchas con historial de menor frecuencia</p></div><button class="btn btn-soft btn-small" data-page="repertorio">Ver catálogo ↗</button></div><div class="pro-card-body">${bottom.length?bmmBarChart(bottom.map(m=>({label:m.name,count:m.count}))):'<div class="chart-empty">Todavía no hay datos.</div>'}</div></section>
        <section class="pro-card span-12 bmm-analytics-definitions"><div class="pro-card-head"><div><h2>Cómo se calculan los indicadores</h2><p>Para interpretar correctamente los resultados del periodo ${esc(periodLabel)}.</p></div></div><div class="pro-card-body"><div class="bmm-analytics-definition-grid"><div><strong>Interpretaciones</strong><span>Cuenta cada aparición de una marcha anotada en actuaciones consideradas realizadas. Si una marcha se repite en una misma actuación, cada aparición cuenta.</span></div><div><strong>Actuaciones distintas</strong><span>Cuenta cada evento una sola vez por marcha, aunque esa marcha se haya interpretado varias veces en el mismo evento.</span></div><div><strong>Marchas sin interpretar</strong><span>Marchas del catálogo sin apariciones en el periodo seleccionado; no significa necesariamente que nunca se hayan tocado en otro año.</span></div><div><strong>Última interpretación</strong><span>Fecha y actuación más reciente dentro del periodo analizado. Los datos incompletos se muestran como «—», sin inventar fechas.</span></div></div></div></section>
        <section class="pro-card span-12"><div class="pro-card-head"><div><h2>Inventario completo de interpretaciones</h2><p>La tabla completa muestra las apariciones registradas, las actuaciones distintas y la última fecha en la que sonó cada marcha. Toca el título para abrir su historial.</p></div><button class="btn btn-soft btn-small" data-action="export-march-stats-csv">Exportar tabla CSV</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Marcha</th><th>Autor</th><th>Tipo / estilo</th><th>Veces tocada</th><th>Actuaciones distintas</th><th>Última interpretación</th><th>Estado histórico</th></tr></thead><tbody>${marchStats.map(m=>`<tr><td><button class="text-link" data-action="march-insight" data-id="${esc(m.id)}" style="border:0;background:none;padding:0;text-align:left;color:#174f33;font-weight:800;cursor:pointer">${esc(m.name)} ↗</button></td><td>${esc(m.author||'—')}</td><td>${esc(m.style||m.genre||'—')}</td><td><span class="pill ${m.count?'red':''}">${m.count}</span></td><td>${m.events}</td><td>${m.lastEvent?`${esc(fmtDate(m.lastEvent.date))}${m.lastEvent.name?`<div class="secondary-cell">${esc(m.lastEvent.name)}</div>`:''}`:'—'}</td><td>${m.count?'<span class="status-badge status-realizado">Con historial</span>':'<span class="status-badge status-sin-confirmar">Sin registros</span>'}</td></tr>`).join('')}</tbody></table></div></section>
      </div>`;
  };

  renderGroups = function(){
    const q=bmmGroupSearch.trim().toLocaleLowerCase('es');const groups=state.groupsCatalog.filter(g=>!q||[g.name,g.description].join(' ').toLocaleLowerCase('es').includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    const groupEventMap=new Map(state.groupsCatalog.map(g=>[g.name.toLocaleLowerCase('es'),state.events.filter(e=>bmmGroup(e).toLocaleLowerCase('es')===g.name.toLocaleLowerCase('es'))]));
    const totalGroups=state.groupsCatalog.length;const emptyGroups=state.groupsCatalog.filter(g=>!(groupEventMap.get(g.name.toLocaleLowerCase('es'))||[]).length).length;
    return `${bmmHeader('Estructura del calendario','Grupos de eventos','Organiza las actuaciones en campañas o colecciones —por ejemplo, Semana Santa, Fiestas Patronales o Navidad—. Los nombres de grupo se pueden reutilizar al crear cada evento.',`<button class="btn btn-soft" data-action="preview-section-pdf" data-report-type="groups">▧ PDF de grupos</button><button class="btn btn-primary" data-action="add-group">＋ Nuevo grupo</button>`)}
      <div class="filterbar"><div class="searchbox"><span>⌕</span><input id="groupSearch" type="search" value="${esc(bmmGroupSearch)}" placeholder="Buscar grupos…"></div><span class="pill">${totalGroups} grupos</span><span class="pill gold">${emptyGroups} sin eventos</span></div>
      <div class="group-grid">${groups.map((g,i)=>{const evs=groupEventMap.get(g.name.toLocaleLowerCase('es'))||[];const ps=totalPlays(evs);const marches=new Set(allPlays(evs).map(p=>p.march.id)).size;return `<article class="group-tile" style="--group-accent:${esc(g.color||bmmColors[i%bmmColors.length])}"><h3>${esc(g.name)}</h3><p>${esc(g.description||'Sin descripción. Edita el grupo para documentar su finalidad.')}</p><div class="group-stats"><div class="group-stat"><strong>${evs.length}</strong><span>Eventos</span></div><div class="group-stat"><strong>${ps}</strong><span>Interpretaciones</span></div><div class="group-stat"><strong>${marches}</strong><span>Marchas distintas</span></div><div class="group-stat"><strong>${evs.filter(e=>bmmStatus(e)==='Realizado').length}</strong><span>Realizados</span></div></div><div class="group-actions"><button class="btn btn-soft btn-small" data-action="group-events" data-value="${esc(g.name)}">Ver eventos</button><button class="btn btn-soft btn-small" data-action="group-insight" data-id="${esc(g.id)}">▥ Indicadores</button><button class="icon-btn" data-action="edit-group" data-id="${esc(g.id)}" title="Editar grupo">✎</button><button class="icon-btn" data-action="delete-group" data-id="${esc(g.id)}" title="Eliminar grupo">⌫</button></div></article>`}).join('')||'<div class="chart-empty" style="grid-column:1/-1">No hay grupos que coincidan con la búsqueda.</div>'}</div>
      <section class="pro-card" style="margin-top:18px"><div class="pro-card-head"><div><h2>Distribución por grupo</h2><p>Número de actuaciones asociadas a cada campaña</p></div></div><div class="pro-card-body">${bmmBarChart(state.groupsCatalog.map(g=>({label:g.name,count:groupEventMap.get(g.name.toLocaleLowerCase('es'))?.length||0})).sort((a,b)=>b.count-a.count))}</div></section>
      <section class="pro-card" style="margin-top:18px"><div class="pro-card-head"><div><h2>Buenas prácticas para el registro</h2><p>Consistencia del histórico para obtener indicadores fiables</p></div></div><div class="pro-card-body"><div class="insight-row"><div class="insight-icon">1</div><div><strong>Reutiliza el mismo nombre de grupo</strong><span>Así podrás comparar eventos de distintas fechas y años sin fragmentar la información en grupos casi iguales.</span></div></div><div class="insight-row"><div class="insight-icon">2</div><div><strong>Usa la categoría para el tipo de servicio</strong><span>Por ejemplo, «Procesión» describe la clase de evento y «Semana Santa» lo agrupa con otros servicios de la campaña.</span></div></div><div class="insight-row"><div class="insight-icon">3</div><div><strong>Completa las marchas interpretadas</strong><span>Los informes de frecuencia y los rankings solo son fiables cuando se registran las interpretaciones que efectivamente se tocaron.</span></div></div></div></section>`;
  };

  function bmmAddActionButtons(){
    const oldTop=document.querySelector('.top-right .btn[data-action="add-event"]');if(oldTop)oldTop.innerHTML='＋ Nueva actuación';
  }

  // Extended event editor retains old records and provides reusable event groups.
  eventForm = function(e){
    const isDuplicate=!!(e&&e._bmmDuplicate);if(isDuplicate)e={...e,id:'',name:(e.name||'')+' (copia)',status:'Planificado',sourceKey:'',_bmmDuplicate:false};
    currentEditEvent=e?.id||null;const isEdit=!!e&&!isDuplicate;
    const groups=bmmUniq([...state.groupsCatalog.map(g=>g.name),...state.events.map(x=>x.group)]).sort((a,b)=>a.localeCompare(b,'es'));
    const body=`<form id="eventForm"><input type="hidden" name="eventId" value="${esc(e?.id||'')}">
      <div class="form-grid"><div class="field"><label>Fecha *</label><input name="date" type="date" required value="${esc(e?.date||bmmTodayKey())}"></div><div class="field"><label>Hora de inicio</label><input name="time" type="time" value="${esc(e?.time||'')}"></div>
      <div class="field"><label>Tipo de evento</label><select name="category">${state.categories.map(c=>`<option value="${esc(c)}" ${(e?.category||state.categories[0])===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Estado</label><select name="status">${['Planificado','Realizado','Cancelado'].map(s=>`<option value="${esc(s)}" ${(bmmStatus(e||{})===s)?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field full"><label>Nombre de la procesión / evento *</label><input name="name" required maxlength="140" value="${esc(e?.name||'')}" placeholder="Ej. Domingo de Ramos · Procesión de la Borriquilla"></div>
      <div class="field"><label>Grupo / campaña</label><input name="group" list="eventGroups" maxlength="100" value="${esc(e?.group||'') }" placeholder="Ej. Semana Santa"><datalist id="eventGroups">${groups.map(g=>`<option value="${esc(g)}">`).join('')}</datalist></div><div class="field"><label>Localidad</label><input name="locality" maxlength="100" value="${esc(e?.locality||'Arjonilla')}" placeholder="Localidad del acto"></div>
      <div class="field"><label>Organiza / hermandad</label><input name="organizer" maxlength="120" value="${esc(e?.organizer||'')}" placeholder="Hermandad, ayuntamiento…"></div><div class="field"><label>Duración estimada (min)</label><input name="duration" type="number" min="0" max="1440" value="${esc(e?.duration||'')}" placeholder="Ej. 180"></div>
      <div class="field"><label>Inicio / punto de salida</label><input name="startPlace" maxlength="120" value="${esc(e?.startPlace||'')}" placeholder="Punto de inicio"></div><div class="field"><label>Final / llegada</label><input name="endPlace" maxlength="120" value="${esc(e?.endPlace||'')}" placeholder="Punto final"></div>
      <div class="field full"><label>Recorrido / itinerario (opcional)</label><input name="route" maxlength="250" value="${esc(e?.route||'')}" placeholder="Calles, plazas o recorrido previsto"></div>
      <div class="field full"><label>Etiquetas / palabras clave</label><input name="eventTags" maxlength="240" value="${esc((e?.tags||[]).join(', '))}" placeholder="Ej. Semana Santa, titular, recorrido largo"><div class="footnote">Separa las etiquetas con comas. Puedes usarlas para búsquedas y clasificaciones personales.</div></div>
      <div class="field full"><label>Notas generales</label><textarea name="eventNotes" rows="3" placeholder="Información logística, indicaciones para el director…">${esc(e?.notes||'')}</textarea></div></div>
      ${quickMarchPicker()}<div class="marches-head"><h3>Marchas interpretadas <span class="pill">Selección múltiple</span></h3><button type="button" class="btn btn-soft btn-small" data-action="add-march-row">＋ Detallar marcha</button></div><div id="marchRows">${(e?.marches?.length?[...e.marches].sort((a,b)=>(+a.order||0)-(+b.order||0)): [{}]).map(marchRowHtml).join('')}</div>
      <div class="footnote">Puedes marcar varias marchas de golpe o usar las filas detalladas para controlar el orden con las flechas ↑ y ↓. Pulsa ⧉ para repetir una misma marcha (por ejemplo, un bis o en otra ubicación). Cada aparición se guarda por separado y cuenta de forma independiente en el histórico.</div></form>`;
    openModal(isEdit?'Editar actuación':'Nueva actuación','Registra los datos del evento y el repertorio interpretado en una sola ficha.',body,`<button class="btn btn-soft" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="eventForm">${isEdit?'Guardar cambios':'Guardar actuación'}</button>`);
  };

  marchForm = function(m){
    currentEditMarch=m?.id||null;const body=`<form id="marchForm"><input type="hidden" name="marchId" value="${esc(m?.id||'')}"><div class="form-grid">
      <div class="field full"><label>Nombre de la marcha *</label><input name="name" required maxlength="140" value="${esc(m?.name||'')}" placeholder="Título oficial de la marcha"></div>
      <div class="field"><label>Autor / compositor</label><input name="author" maxlength="140" value="${esc(m?.author||'')}" placeholder="Nombre del compositor"></div><div class="field"><label>Tipo / estilo</label><input name="style" list="marchGenres" maxlength="80" value="${esc(m?.style||'')}" placeholder="Marcha procesional, himno…"><datalist id="marchGenres"><option value="Marcha procesional"><option value="Himno"><option value="Pasacalles"><option value="Música de concierto"><option value="Marcha ordinaria"></datalist></div>
      <div class="field"><label>Temporada / repertorio</label><input name="season" maxlength="80" value="${esc(m?.season||'')}" placeholder="Semana Santa, Navidad…"></div><div class="field"><label>Dificultad (opcional)</label><select name="difficulty"><option value="">Sin valorar</option>${['Inicial','Media','Alta','Muy alta'].map(x=>`<option ${m?.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Año de composición</label><input name="yearComposed" type="number" min="1500" max="2100" value="${esc(m?.yearComposed||'')}" placeholder="Ej. 1925"></div><div class="field"><label>Editorial / fuente</label><input name="publisher" maxlength="120" value="${esc(m?.publisher||'')}" placeholder="Editorial o archivo"></div>
      <div class="field full"><label>Etiquetas / palabras clave</label><input name="marchTags" maxlength="240" value="${esc((m?.tags||[]).join(', '))}" placeholder="Ej. lenta, titular, solemne, repertorio base"><div class="footnote">Puedes escribir varias etiquetas separadas por comas.</div></div><div class="field full"><label>Notas del repertorio</label><textarea name="marchNotes" rows="3" placeholder="Datos históricos, versiones, observaciones…">${esc(m?.notes||'')}</textarea></div></div></form>`;
    openModal(m?'Editar marcha':'Añadir marcha','Completa el catálogo; los autores no se inventan al importar documentos.',body,`<button class="btn btn-soft" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="marchForm">${m?'Guardar cambios':'Añadir al repertorio'}</button>`,true);
  };

  function bmmOpenMarchInsight(m){
    if(!m)return;const ps=bmmPerf().filter(p=>p.march.id===m.id);const eventSet=new Set(ps.map(p=>p.event.id));const eventCounts=Object.entries(bmmCountBy(ps,p=>bmmGroup(p.event))).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);const yearCounts=Object.entries(bmmCountBy(ps,p=>bmmYear(p.event))).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label));const first=ps[0]?.event;const last=ps.at(-1)?.event;const frequency=state.events.length?Math.round(eventSet.size/state.events.length*100):0;
    const history=ps.slice().reverse().map((p,i)=>`<div class="timeline-item past"><div class="timeline-event-top"><div class="timeline-date"><strong>${bmmDate(p.event.date)?bmmDate(p.event.date).getDate():'—'}</strong><span>${esc(fmtDate(p.event.date,{month:'short',year:'numeric'}))}</span></div><div class="timeline-info"><h3>${esc(p.event.name)}</h3><div class="timeline-meta"><span>${esc(bmmGroup(p.event))}</span><span>${esc(p.event.category||'Otro')}</span>${p.event.locality?`<span>${esc(p.event.locality)}</span>`:''}</div>${p.location?`<p style="margin:7px 0 0;font-size:11px;color:#76867c">Momento: ${esc(p.location)}</p>`:''}${p.notes?`<p style="margin:4px 0 0;font-size:11px;color:#76867c">Observaciones: ${esc(p.notes)}</p>`:''}</div><button type="button" class="icon-btn" data-action="edit-event" data-id="${esc(p.event.id)}" title="Abrir actuación">↗</button></div></div>`).join('');
    const body=`<div class="pro-grid" style="margin-bottom:16px"><div class="span-6">${bmmProKpi('♫','Veces interpretada',ps.length,'Apariciones anotadas')}</div><div class="span-6">${bmmProKpi('▦','Actuaciones distintas',eventSet.size,`${frequency}% del histórico de actuaciones`,'#e3edf2')}</div><div class="span-6">${bmmProKpi('↗','Primera aparición',first?fmtDate(first.date):'Sin datos',first?.name||'')}</div><div class="span-6">${bmmProKpi('◷','Última aparición',last?fmtDate(last.date):'Sin datos',last?.name||'','#fbf0d0')}</div></div><div class="pro-grid"><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Reparto por grupo</h2><p>En qué campañas se ha interpretado</p></div></div><div class="pro-card-body">${bmmBarChart(eventCounts)}</div></section><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Frecuencia por año</h2><p>Apariciones registradas cada año</p></div></div><div class="pro-card-body">${bmmBarChart(yearCounts.map(x=>({label:x.label,count:x.count})))}</div></section><section class="pro-card span-12"><div class="pro-card-head"><div><h2>Historial de interpretaciones</h2><p>Del evento más reciente al más antiguo; abre cada actuación para editar su ficha.</p></div></div><div class="pro-card-body">${history?`<div class="timeline">${history}</div>`:'<div class="chart-empty">Esta marcha aún no tiene interpretaciones registradas.</div>'}</div></section></div><div class="setting-card" style="margin-top:14px"><h3 style="margin:0 0 6px">Ficha de repertorio</h3><p style="margin:0;color:var(--muted);font-size:12px">${esc([m.author,m.style,m.season,m.yearComposed?`Composición: ${m.yearComposed}`:'',m.publisher].filter(Boolean).join(' · ')||'Aún no hay datos adicionales en esta ficha.')}</p>${m.notes?`<p style="margin:10px 0 0;font-size:12px">${esc(m.notes)}</p>`:''}</div>`;
    openModal(`Estadísticas · ${m.name}`,`Detalle de frecuencia e historial de la marcha.`,body,`<button class="btn btn-soft" type="button" data-action="close-modal">Cerrar</button><button class="btn btn-soft" type="button" data-action="march-pdf" data-id="${esc(m.id)}">▧ Ficha PDF</button><button class="btn btn-primary" type="button" data-action="edit-march" data-id="${esc(m.id)}">Editar ficha</button>`,false);
  }

  function bmmEventStats(e){
    const ps=(e.marches||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0)).map((p,i)=>({...p,index:i+1,march:getMarch(p.marchId)})).filter(p=>p.march);
    const authors=new Set(ps.map(p=>p.march.author).filter(Boolean));
    const styles=Object.entries(bmmCountBy(ps,p=>p.march.style||'Sin estilo')).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);
    const core=[e.date,e.time,e.group,e.category,e.locality,e.organizer,e.startPlace,e.endPlace,e.route,e.notes].filter(x=>String(x||'').trim()).length;
    return {ps,authors,styles,core,total:10};
  }
  function bmmEventReportBody(e){
    const d=bmmEventStats(e), status=bmmStatus(e), logo=document.querySelector('.brand-mark img')?.src||'';
    const rows=d.ps.map((p,i)=>`<tr><td>${p.order||i+1}</td><td>${esc(p.march.name)}</td><td>${esc(p.march.author||'—')}</td><td>${esc(p.startTime||'—')}</td><td>${esc(p.duration?p.duration+' min':'—')}</td><td>${esc(p.location||'—')}</td><td>${esc(p.notes||'—')}</td></tr>`).join('');
    return `<div class="report-doc"><div class="report-doc-header">${logo?`<img class="report-doc-logo" src="${logo}" alt="Escudo de Santa Cecilia">`:''}<div><div class="report-doc-kicker">BMM Santa Cecilia de Arjonilla · ficha de evento</div><h1>${esc(e.name)}</h1><div class="report-doc-subtitle">${fmtDate(e.date)}${e.time?' · '+esc(e.time):''} · ${esc(bmmGroup(e))} · ${esc(e.category||'Otro')}</div></div></div><div class="report-doc-kpis"><div class="report-doc-kpi"><strong>${d.ps.length}</strong><span>Interpretaciones anotadas</span></div><div class="report-doc-kpi"><strong>${new Set(d.ps.map(p=>p.march.id)).size}</strong><span>Marchas distintas</span></div><div class="report-doc-kpi"><strong>${d.authors.size}</strong><span>Autores identificados</span></div><div class="report-doc-kpi"><strong>${esc(status)}</strong><span>Estado</span></div></div><h2>Ficha logística</h2><table><tbody><tr><th>Localidad</th><td>${esc(e.locality||'—')}</td><th>Organiza</th><td>${esc(e.organizer||'—')}</td></tr><tr><th>Duración</th><td>${esc(e.duration?e.duration+' min':'—')}</td><th>Grupo</th><td>${esc(bmmGroup(e))}</td></tr><tr><th>Salida</th><td>${esc(e.startPlace||'—')}</td><th>Llegada</th><td>${esc(e.endPlace||'—')}</td></tr><tr><th>Itinerario</th><td colspan="3">${esc(e.route||'—')}</td></tr><tr><th>Etiquetas</th><td colspan="3">${esc((e.tags||[]).join(' · ')||'—')}</td></tr><tr><th>Observaciones</th><td colspan="3">${esc(e.notes||'—')}</td></tr></tbody></table><h2>Secuencia musical</h2><table><thead><tr><th>Orden</th><th>Marcha</th><th>Autor</th><th>Hora</th><th>Duración</th><th>Momento / ubicación</th><th>Observaciones</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No hay marchas registradas.</td></tr>'}</tbody></table><div class="report-doc-footer"><span>BMM Santa Cecilia de Arjonilla · Ficha para dirección</span><span>${d.ps.length} interpretaciones</span></div></div>`;
  }
  function bmmMarchReportBody(m){
    const ps=bmmPerf().filter(p=>p.march.id===m.id), evs=[...new Map(ps.map(p=>[p.event.id,p.event])).values()], first=ps[0]?.event,last=ps.at(-1)?.event,logo=document.querySelector('.brand-mark img')?.src||'';
    const rows=ps.slice().reverse().map(p=>`<tr><td>${fmtDate(p.event.date)}${p.event.time?' · '+esc(p.event.time):''}</td><td>${esc(p.event.name)}</td><td>${esc(bmmGroup(p.event))}</td><td>${esc(p.location||'—')}</td><td>${esc(p.notes||'—')}</td></tr>`).join('');
    return `<div class="report-doc"><div class="report-doc-header">${logo?`<img class="report-doc-logo" src="${logo}" alt="Escudo de Santa Cecilia">`:''}<div><div class="report-doc-kicker">BMM Santa Cecilia de Arjonilla · ficha de repertorio</div><h1>${esc(m.name)}</h1><div class="report-doc-subtitle">${esc(m.author||'Autor sin indicar')} · ${esc(m.style||'Estilo sin clasificar')}</div></div></div><div class="report-doc-kpis"><div class="report-doc-kpi"><strong>${ps.length}</strong><span>Veces interpretada</span></div><div class="report-doc-kpi"><strong>${evs.length}</strong><span>Actuaciones distintas</span></div><div class="report-doc-kpi"><strong>${first?fmtDate(first.date):'—'}</strong><span>Primera aparición</span></div><div class="report-doc-kpi"><strong>${last?fmtDate(last.date):'—'}</strong><span>Última aparición</span></div></div><h2>Ficha de repertorio</h2><table><tbody><tr><th>Autor</th><td>${esc(m.author||'—')}</td><th>Estilo</th><td>${esc(m.style||'—')}</td></tr><tr><th>Temporada</th><td>${esc(m.season||'—')}</td><th>Dificultad</th><td>${esc(m.difficulty||'—')}</td></tr><tr><th>Año de composición</th><td>${esc(m.yearComposed||'—')}</td><th>Editorial / fuente</th><td>${esc(m.publisher||'—')}</td></tr><tr><th>Etiquetas</th><td colspan="3">${esc((m.tags||[]).join(' · ')||'—')}</td></tr><tr><th>Notas</th><td colspan="3">${esc(m.notes||'—')}</td></tr></tbody></table><h2>Historial de interpretaciones</h2><table><thead><tr><th>Fecha</th><th>Evento</th><th>Grupo</th><th>Ubicación</th><th>Observaciones</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Esta marcha aún no tiene apariciones registradas.</td></tr>'}</tbody></table><div class="report-doc-footer"><span>BMM Santa Cecilia de Arjonilla · Estadística del histórico</span><span>${ps.length} apariciones · ${evs.length} eventos</span></div></div>`;
  }
  function bmmGroupReportBody(g){
    const evs=state.events.filter(e=>bmmGroup(e).toLocaleLowerCase('es')===g.name.toLocaleLowerCase('es')).sort((a,b)=>(a.date||'').localeCompare(b.date||'')),ps=bmmPerf(evs),top=Object.entries(bmmCountBy(ps,p=>p.march.name)).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,12),cats=Object.entries(bmmCountBy(evs,e=>e.category)).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count),logo=document.querySelector('.brand-mark img')?.src||'';
    const rows=evs.map(e=>`<tr><td>${fmtDate(e.date)}${e.time?' · '+esc(e.time):''}</td><td>${esc(e.name)}</td><td>${esc(e.category||'Otro')}</td><td>${esc(bmmStatus(e))}</td><td>${(e.marches||[]).length}</td></tr>`).join('');
    return `<div class="report-doc"><div class="report-doc-header">${logo?`<img class="report-doc-logo" src="${logo}" alt="Escudo de Santa Cecilia">`:''}<div><div class="report-doc-kicker">BMM Santa Cecilia de Arjonilla · ficha de grupo</div><h1>${esc(g.name)}</h1><div class="report-doc-subtitle">${esc(g.description||'Grupo de eventos')} · ${evs.length} eventos registrados</div></div></div><div class="report-doc-kpis"><div class="report-doc-kpi"><strong>${evs.length}</strong><span>Eventos</span></div><div class="report-doc-kpi"><strong>${ps.length}</strong><span>Interpretaciones</span></div><div class="report-doc-kpi"><strong>${new Set(ps.map(p=>p.march.id)).size}</strong><span>Marchas distintas</span></div><div class="report-doc-kpi"><strong>${evs.filter(e=>bmmStatus(e)==='Realizado').length}</strong><span>Realizados</span></div></div><h2>Marchas más frecuentes en el grupo</h2>${top.length?`<table><thead><tr><th>Marcha</th><th>Veces interpretada</th></tr></thead><tbody>${top.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.count}</td></tr>`).join('')}</tbody></table>`:'<p>Aún no hay interpretaciones vinculadas a este grupo.</p>'}<h2>Histórico del grupo</h2><table><thead><tr><th>Fecha</th><th>Evento</th><th>Tipo</th><th>Estado</th><th>Marchas</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No hay actuaciones en este grupo.</td></tr>'}</tbody></table><h2>Composición por categoría</h2>${cats.length?`<table><thead><tr><th>Categoría</th><th>Eventos</th></tr></thead><tbody>${cats.map(x=>`<tr><td>${esc(x.label)}</td><td>${x.count}</td></tr>`).join('')}</tbody></table>`:'<p>Sin categorías registradas.</p>'}<div class="report-doc-footer"><span>BMM Santa Cecilia de Arjonilla · Informe de grupo</span><span>${evs.length} eventos · ${ps.length} interpretaciones</span></div></div>`;
  }
  function bmmOpenEventInsight(e){
    const d=bmmEventStats(e),ps=d.ps,marchList=ps.map((p,i)=>`<div class="event-stat-march"><span class="order-chip">${p.order||i+1}</span><div class="event-stat-march-info"><strong>${esc(p.march.name)}</strong><span>${esc(p.march.author||'Autor sin indicar')}${p.startTime?' · '+esc(p.startTime):''}${p.duration?' · '+esc(p.duration)+' min':''}</span>${p.location?`<small>⌖ ${esc(p.location)}</small>`:''}${p.notes?`<small>${esc(p.notes)}</small>`:''}</div><button class="icon-btn" data-action="march-insight" data-id="${esc(p.march.id)}" title="Ver estadísticas de esta marcha">▥</button></div>`).join('');
    const body=`<div class="pro-grid" style="margin-bottom:15px"><div class="span-6">${bmmProKpi('♫',bmmStatus(e)==='Realizado'?'Interpretaciones realizadas':'Marchas programadas',ps.length,bmmStatus(e)==='Realizado'?'Apariciones confirmadas en el histórico':'El plan no cuenta como interpretación real hasta marcar el evento como realizado')}</div><div class="span-6">${bmmProKpi('♬','Marchas distintas',new Set(ps.map(p=>p.march.id)).size,'Sin contar repeticiones')}</div><div class="span-6">${bmmProKpi('♙','Autores representados',d.authors.size,'Autores conocidos','#e3edf2')}</div><div class="span-6">${bmmProKpi('✓','Estado',bmmStatus(e),e.duration?`Duración estimada: ${e.duration} min`:'Duración no indicada','#fbf0d0')}</div></div><div class="pro-grid"><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Composición del repertorio</h2><p>Marchas agrupadas por estilo</p></div></div><div class="pro-card-body">${bmmBarChart(d.styles)}</div></section><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Ficha del acto</h2><p>Datos logísticos y etiquetas</p></div></div><div class="pro-card-body"><div class="insight-row"><div class="insight-icon">⌖</div><div><strong>${esc(e.locality||'Localidad sin indicar')}</strong><span>${esc([e.startPlace,e.endPlace].filter(Boolean).join(' → ')||'Sin puntos de salida y llegada')}</span></div></div><div class="insight-row"><div class="insight-icon">♧</div><div><strong>${esc(e.organizer||'Organizador sin indicar')}</strong><span>${esc(e.route||'Sin itinerario documentado')}</span></div></div><div class="insight-row"><div class="insight-icon">✎</div><div><strong>${d.core}/10 campos logísticos cumplimentados</strong><span>${esc((e.tags||[]).join(' · ')||'Sin etiquetas')} ${e.notes?' · Tiene observaciones':' · Sin notas generales'}</span></div></div></div></section><section class="pro-card span-12"><div class="pro-card-head"><div><h2>Secuencia musical</h2><p>Orden del repertorio; cada marcha abre su historial analítico.</p></div><span class="pill gold">${ps.length} filas</span></div><div class="pro-card-body">${marchList||'<div class="chart-empty">No hay marchas anotadas. Edita la actuación para añadir varias a la vez.</div>'}</div></section></div>`;
    openModal(`Analítica del evento · ${e.name}`,`${fmtDate(e.date)}${e.time?' · '+e.time:''} · ${bmmGroup(e)} · ${e.category||'Otro'}`,body,`<button class="btn btn-soft" type="button" data-action="close-modal">Cerrar</button><button class="btn btn-soft" type="button" data-action="event-pdf" data-id="${esc(e.id)}">▧ Ficha PDF</button><button class="btn btn-primary" type="button" data-action="edit-event" data-id="${esc(e.id)}">Editar evento</button>`,false);
  }
  function bmmOpenGroupInsight(g){
    const evs=state.events.filter(e=>bmmGroup(e).toLocaleLowerCase('es')===g.name.toLocaleLowerCase('es')).sort((a,b)=>(a.date||'').localeCompare(b.date||'')),ps=bmmPerf(evs),top=Object.entries(bmmCountBy(ps,p=>p.march.name)).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,8),cats=Object.entries(bmmCountBy(evs,e=>e.category)).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count),history=evs.slice().reverse().map(e=>`<div class="timeline-item ${bmmIsPast(e)?'past':'future'}"><div class="timeline-event-top"><div class="timeline-date"><strong>${bmmDate(e.date)?bmmDate(e.date).getDate():'—'}</strong><span>${esc(fmtDate(e.date,{month:'short',year:'numeric'}))}</span></div><div class="timeline-info"><h3>${esc(e.name)}</h3><div class="timeline-meta"><span>${esc(e.category||'Otro')}</span><span>${esc(bmmStatus(e))}</span><span>${(e.marches||[]).length} marchas</span></div></div><button class="icon-btn" data-action="event-insight" data-id="${esc(e.id)}">▥</button><button class="icon-btn" data-action="edit-event" data-id="${esc(e.id)}">✎</button></div></div>`).join('');
    const body=`<div class="pro-grid" style="margin-bottom:15px"><div class="span-6">${bmmProKpi('▦','Eventos',evs.length,'Actuaciones asociadas')}</div><div class="span-6">${bmmProKpi('♫','Interpretaciones',ps.length,'Apariciones de marchas')}</div><div class="span-6">${bmmProKpi('♬','Marchas distintas',new Set(ps.map(p=>p.march.id)).size,'Diversidad de repertorio','#e3edf2')}</div><div class="span-6">${bmmProKpi('✓','Realizados',evs.filter(e=>bmmStatus(e)==='Realizado').length,'Histórico completado','#fbf0d0')}</div></div><div class="pro-grid"><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Marchas más frecuentes</h2><p>Ranking dentro del grupo</p></div></div><div class="pro-card-body">${bmmBarChart(top)}</div></section><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Eventos por categoría</h2><p>Distribución de los actos</p></div></div><div class="pro-card-body">${bmmBarChart(cats)}</div></section><section class="pro-card span-12"><div class="pro-card-head"><div><h2>Historial de eventos</h2><p>Abre cada actuación para consultar su secuencia musical.</p></div></div><div class="pro-card-body">${history?`<div class="timeline">${history}</div>`:'<div class="chart-empty">Este grupo aún no tiene eventos vinculados.</div>'}</div></section></div>`;
    openModal(`Analítica del grupo · ${g.name}`,g.description||'Estadísticas de la campaña o colección.',body,`<button class="btn btn-soft" type="button" data-action="close-modal">Cerrar</button><button class="btn btn-soft" type="button" data-action="group-pdf" data-id="${esc(g.id)}">▧ Ficha PDF</button><button class="btn btn-primary" type="button" data-action="edit-group" data-id="${esc(g.id)}">Editar grupo</button>`,false);
  }

  function bmmOpenGroupForm(g){
    bmmEditingGroup=g?.id||null;const body=`<form id="bmmGroupForm"><input type="hidden" name="groupId" value="${esc(g?.id||'')}"><div class="form-grid"><div class="field full"><label>Nombre del grupo *</label><input name="groupName" required maxlength="100" value="${esc(g?.name||'')}" placeholder="Ej. Semana Santa"></div><div class="field full"><label>Descripción / alcance</label><textarea name="groupDescription" rows="3" placeholder="Qué tipos de eventos reúne este grupo…">${esc(g?.description||'')}</textarea></div><div class="field full"><label>Color identificativo</label><div style="display:flex;gap:8px;flex-wrap:wrap">${bmmColors.map(c=>`<label style="display:flex;align-items:center;gap:5px;background:#f5f7f1;border:1px solid #e2e9de;padding:8px;border-radius:9px"><input type="radio" name="groupColor" value="${esc(c)}" ${((g?.color||bmmColors[0])===c)?'checked':''}><span style="display:inline-block;width:18px;height:18px;background:${c};border-radius:50%"></span></label>`).join('')}</div></div></div></form>`;
    openModal(g?'Editar grupo':'Nuevo grupo','Crea y organiza campañas que puedas reutilizar al registrar actuaciones.',body,`<button class="btn btn-soft" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="bmmGroupForm">Guardar grupo</button>`,true);
  }

  // Report generator: data selection, previews and printable A4 documents.
  function bmmReportEvents(){
    const filtered = getReportFilteredEvents();
    return reportSelectionTouched ? filtered.filter(e=>selectedReportEvents.has(e.id)) : filtered;
  }
  const bmmBaseGetReportFilteredEvents = getReportFilteredEvents;
  getReportFilteredEvents = function(){const rows=bmmBaseGetReportFilteredEvents();return bmmScopedEventIds?rows.filter(e=>bmmScopedEventIds.has(e.id)):rows;};
  function bmmClearReportScope(){bmmScopedMarchIds=null;bmmScopedGroupIds=null;bmmScopedEventIds=null;bmmScopedAnalysisEventIds=null;bmmScopeDescription='';}
  function bmmReportGroups(){return state.groupsCatalog.filter(g=>!bmmScopedGroupIds||bmmScopedGroupIds.has(g.id));}
  function bmmStatsRows(){const scopeEvents=(bmmReportType==='analytics'&&bmmScopedAnalysisEventIds)?state.events.filter(e=>bmmScopedAnalysisEventIds.has(e.id)):state.events;const c=counts(scopeEvents),appearancesByMarch=bmmIndexPlays(bmmPerf(scopeEvents));return state.repertoire.filter(m=>!bmmScopedMarchIds||bmmScopedMarchIds.has(m.id)).map(m=>({...m,count:c[m.id]||0,events:new Set((appearancesByMarch.get(m.id)||[]).map(p=>p.event.id)).size})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es'));}
  function bmmReportDateLabel(date){
    if(!date)return 'Fecha sin especificar';
    const parsed=/^\d{4}-\d{2}-\d{2}$/.test(String(date))?new Date(`${date}T12:00:00`):new Date(date);
    if(Number.isNaN(parsed.getTime()))return 'Fecha sin especificar';
    const label=new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(parsed);
    return label.charAt(0).toLocaleUpperCase('es')+label.slice(1);
  }
  function bmmReportEventsByDate(events,options={}){
    const timeline=options.timeline===true,includeNotes=bmmReportIncludeNotes,includeAuthors=bmmReportIncludeAuthors;
    const sorted=[...(events||[])].sort((a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||(a.time||'').localeCompare(b.time||'')||(a.name||'').localeCompare(b.name||'','es'));
    if(!sorted.length)return '<p class="report-empty">No hay actuaciones que coincidan con los filtros seleccionados.</p>';
    const byDate=new Map();
    sorted.forEach(e=>{const key=e.date||'';if(!byDate.has(key))byDate.set(key,[]);byDate.get(key).push(e);});
    return `<div class="report-events-by-date">${[...byDate.entries()].map(([date,dayEvents])=>`<section class="report-date-group"><h2 class="report-date-heading">${esc(bmmReportDateLabel(date))}</h2>${dayEvents.map(e=>{
      const marches=(e.marches||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0));
      const meta=[e.time?`Hora: ${e.time}`:'',e.locality||'',bmmGroup(e),timeline?(e.category||'Otro'):''].filter(Boolean).join(' · ');
      const eventNotes=includeNotes&&e.notes?`<div class="report-event-notes"><strong>Observaciones del evento:</strong> ${esc(e.notes)}</div>`:'';
      const marchTable=marches.length?`<table class="report-event-table"><thead><tr><th class="report-col-number">#</th><th>Marcha${includeAuthors?' / autor':''}</th><th>Momento / observaciones</th></tr></thead><tbody>${marches.map((performance,i)=>{
        const march=getMarch(performance.marchId);
        const extra=[performance.location,includeNotes?performance.notes:''].filter(Boolean).join(' · ');
        return `<tr><td class="n">${esc(performance.order||i+1)}</td><td><strong>${esc(march?.name||'Marcha eliminada')}</strong>${includeAuthors&&march?.author?`<br><span class="report-event-author">${esc(march.author)}</span>`:''}</td><td>${esc(extra||'—')}</td></tr>`;
      }).join('')}</tbody></table>`:'<div class="report-no-marches">No hay marchas registradas en esta actuación.</div>';
      return `<article class="report-event-block"><header class="report-event-heading"><div class="report-event-heading-main"><h3>${esc(e.name||'Actuación sin título')}</h3><div class="report-event-meta">${esc(meta||'Sin información adicional')}</div></div><span class="report-event-tag">${esc(timeline?bmmStatus(e):(e.category||'Otro'))}</span></header>${eventNotes}${timeline?`<div class="report-event-status"><strong>Estado:</strong> ${esc(bmmStatus(e))}</div>`:''}${marchTable}</article>`;
    }).join('')}</section>`).join('')}</div>`;
  }
  function bmmReportTable(events,type){
    const includeNotes=bmmReportIncludeNotes, includeAuthors=bmmReportIncludeAuthors;
    if(type==='repertoire')return `<h2>Catálogo de marchas</h2><table><thead><tr><th>Marcha</th>${includeAuthors?'<th>Autor</th>':''}<th>Estilo</th><th>Interpretaciones</th><th>Eventos diferentes</th></tr></thead><tbody>${bmmStatsRows().map(m=>`<tr><td>${esc(m.name)}</td>${includeAuthors?`<td>${esc(m.author||'—')}</td>`:''}<td>${esc(m.style||m.genre||'—')}</td><td>${m.count}</td><td>${m.events}</td></tr>`).join('')}</tbody></table>`;
    if(type==='analytics'){
      const stats=bmmStatsRows();const reportEvents=(bmmScopedAnalysisEventIds?state.events.filter(e=>bmmScopedAnalysisEventIds.has(e.id)):state.events);const years=bmmCountBy(reportEvents,bmmYear);const top=stats.filter(m=>m.count>0).slice(0,20);
      return `<h2>Frecuencia por marcha (top 20)</h2><table><thead><tr><th>#</th><th>Marcha</th>${includeAuthors?'<th>Autor</th>':''}<th>Veces tocada</th><th>Actuaciones</th></tr></thead><tbody>${top.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.name)}</td>${includeAuthors?`<td>${esc(m.author||'—')}</td>`:''}<td>${m.count}</td><td>${m.events}</td></tr>`).join('')}</tbody></table><h2>Actuaciones por año</h2><table><thead><tr><th>Año</th><th>Actuaciones</th><th>Interpretaciones</th></tr></thead><tbody>${Object.keys(years).sort().reverse().map(y=>`<tr><td>${esc(y)}</td><td>${years[y]}</td><td>${totalPlays(reportEvents.filter(e=>bmmYear(e)===y))}</td></tr>`).join('')}</tbody></table>`;
    }
    if(type==='groups')return `<h2>Resumen de grupos</h2><table><thead><tr><th>Grupo</th><th>Eventos</th><th>Interpretaciones</th><th>Marchas distintas</th></tr></thead><tbody>${bmmReportGroups().map(g=>{const es=state.events.filter(e=>bmmGroup(e).toLocaleLowerCase('es')===g.name.toLocaleLowerCase('es'));return `<tr><td>${esc(g.name)}</td><td>${es.length}</td><td>${totalPlays(es)}</td><td>${new Set(allPlays(es).map(p=>p.march.id)).size}</td></tr>`}).join('')}</tbody></table>`;
    return bmmReportEventsByDate(events);
  }
  function bmmFullMembersTable(){
    const rows=(Array.isArray(state.members)?state.members:[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
    if(!rows.length)return '<p>No se han registrado integrantes de la banda todavía.</p>';
    return `<p>${rows.length} integrantes · ${rows.filter(m=>(m.status||'Activo')==='Activo').length} activos · ${new Set(rows.map(m=>m.instrument).filter(Boolean)).size} instrumentos representados.</p><table><thead><tr><th>Integrante</th><th>Instrumento</th><th>Año de inscripción</th><th>Sección / cuerda</th><th>Función</th><th>Estado</th></tr></thead><tbody>${rows.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.instrument||'—')}</td><td>${esc(m.registrationYear||'—')}</td><td>${esc(m.section||'—')}</td><td>${esc(m.role||'—')}</td><td>${esc(m.status||'Activo')}</td></tr>`).join('')}</tbody></table>`;
  }
  function bmmReportContent(type,title,events,options={}){
    const plays=totalPlays(events);const unique=new Set(allPlays(events).map(p=>p.march.id)).size;const logo=document.querySelector('.brand-mark img')?.src||'';
    const desc=({full:'Inventario y actividad completa de la banda',events:'Actuaciones seleccionadas y sus marchas interpretadas',timeline:'Secuencia cronológica de eventos de la banda',repertoire:'Catálogo de marchas y su uso documentado',analytics:'Indicadores de frecuencia de interpretación y actividad',groups:'Estructura de grupos, campañas y eventos'})[type]||'Informe de gestión musical';
    const statBox=bmmReportIncludeStats?bmmDocKpis(events):'';
    const filters=[reportYear!=='all'?'Año '+reportYear:'',reportGroup!=='all'?'Grupo '+reportGroup:'',reportCategory!=='all'?'Tipo '+reportCategory:'',reportFrom?'Desde '+fmtDate(reportFrom):'',reportTo?'Hasta '+fmtDate(reportTo):'',bmmScopeDescription].filter(Boolean).join(' · ');
    let main = type==='full' ? `<h2>Actividad registrada</h2>${bmmReportTable(events,'events')}<h2>Repertorio completo y frecuencia</h2>${bmmReportTable(events,'repertoire')}<h2>Resumen por grupos</h2>${bmmReportTable(events,'groups')}` : bmmReportTable(events,type);
    if(type==='timeline') {
      const timelineEvents=[...events].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||'')||(a.name||'').localeCompare(b.name||'','es'));
      main=`<h2>Cronología de actuaciones</h2>${bmmReportEventsByDate(timelineEvents,{timeline:true})}`;
    }
    if(type==='groups')main += `<h2>Eventos por grupo</h2>${bmmReportGroups().map(g=>{const es=state.events.filter(e=>bmmGroup(e).toLocaleLowerCase('es')===g.name.toLocaleLowerCase('es'));return `<p><strong>${esc(g.name)}</strong> — ${es.length} eventos · ${totalPlays(es)} interpretaciones. ${esc(g.description||'')}</p>`}).join('')}`;
    return `<div class="report-doc"><div class="report-doc-header">${logo?`<img class="report-doc-logo" src="${logo}" alt="Escudo de Santa Cecilia">`:''}<div><div class="report-doc-kicker">BMM Santa Cecilia de Arjonilla</div><h1>${esc(title||'Informe de gestión musical')}</h1><div class="report-doc-subtitle">${esc(desc)} · Generado el ${fmtDate(bmmTodayKey())}</div></div></div>${filters?`<p style="color:#708174;font-size:9px">Filtros aplicados: ${esc(filters)}</p>`:''}${statBox}${main}<div class="report-doc-footer"><span>BMM Santa Cecilia de Arjonilla · Documento de uso interno</span><span>${plays} interpretaciones · ${unique} marchas distintas</span></div></div>`;
  }
  function bmmPrintCss(orientation){return `@page{size:${orientation==='landscape'?'297mm 210mm':'210mm 297mm'};margin:12mm 11mm}*{box-sizing:border-box}html,body{width:100%;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#20382a;-webkit-print-color-adjust:exact;print-color-adjust:exact}.report-doc{width:100%;max-width:none;min-height:0;padding:0;margin:0;font-size:9.5px;line-height:1.42;color:#20382a;overflow:visible;box-shadow:none}.report-doc-header{display:flex;gap:12px;align-items:center;border-bottom:3px solid #1b6340;padding-bottom:11px;margin-bottom:14px;break-after:avoid;page-break-after:avoid}.report-doc-logo{width:52px;height:52px;flex:0 0 52px;object-fit:contain;border-radius:50%;border:1px solid #d1bb6d;padding:3px}.report-doc-kicker{font-size:7.5px;letter-spacing:1px;text-transform:uppercase;color:#62806a;font-weight:bold}.report-doc h1{font:700 22px/1.12 Georgia,serif;color:#16452e;margin:4px 0;overflow-wrap:anywhere}.report-doc-subtitle{color:#5d6e61;font-size:9px}.report-doc h2{font-size:12px;margin:16px 0 7px;padding-bottom:5px;border-bottom:1px solid #dfe7dd;color:#245d3b;break-after:avoid;page-break-after:avoid}.report-doc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:11px 0}.report-doc-kpi{min-width:0;border:1px solid #e0e8dc;background:#f6f9f3;padding:8px;border-radius:6px;break-inside:avoid;page-break-inside:avoid}.report-doc-kpi strong{font-size:17px;display:block;color:#1e5c39;overflow-wrap:anywhere}.report-doc-kpi span{font-size:7.5px;color:#536b5a}.report-doc table{border-collapse:collapse;width:100%;max-width:100%;table-layout:fixed;font-size:8px;margin:7px 0 13px;break-inside:auto;page-break-inside:auto}.report-doc th{background:#164932;color:#fff;text-align:left;padding:5px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}.report-doc td{border-bottom:1px solid #e5ebe2;padding:5px;vertical-align:top;overflow-wrap:anywhere;word-break:normal;white-space:normal}.report-doc tr{break-inside:avoid;page-break-inside:avoid;page-break-after:auto}.report-doc thead{display:table-header-group}.report-doc tfoot{display:table-footer-group}.report-doc tr:nth-child(even) td{background:#f8faf6}.report-doc p,.report-doc li{overflow-wrap:anywhere}.report-doc img{max-width:100%;height:auto}.report-doc-footer{margin-top:18px;padding-top:8px;border-top:1px solid #dfe7dc;color:#829084;font-size:7.5px;display:flex;justify-content:space-between;gap:8px;break-inside:avoid;page-break-inside:avoid}.report-doc .report-doc-kpis,.report-doc .report-doc-header{break-inside:avoid;page-break-inside:avoid}@media screen{body{background:#e8eee7;padding:20px}.report-doc{max-width:1000px;margin:auto;background:white;padding:28px;box-shadow:0 4px 30px #173b2b22}}@media print{html,body{width:auto!important;min-height:0!important;background:#fff!important;padding:0!important;margin:0!important}body{font-size:9.5px!important}a{color:inherit;text-decoration:none}.report-doc{width:100%!important;max-width:none!important;min-height:0!important;padding:0!important;margin:0!important;box-shadow:none!important;overflow:visible!important}.report-doc table{width:100%!important;max-width:100%!important}.report-doc-footer{position:static}.report-doc h2{orphans:3;widows:3}.report-date-heading{font-size:11px!important;font-weight:800!important;text-transform:uppercase;background:#e9f1e5!important;border-left:4px solid #1b6340;padding:7px 9px;margin:14px 0 8px;color:#12482f!important;break-after:avoid!important;page-break-after:avoid!important}.report-date-group{margin:0 0 13px}.report-event-block{border:1px solid #dce5d8;border-radius:5px;margin:0 0 10px;overflow:hidden;break-inside:avoid-page;page-break-inside:avoid}.report-event-heading{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:8px;background:#f7f9f4!important;border-bottom:1px solid #e2e9df;break-after:avoid;page-break-after:avoid}.report-event-heading h3{font-size:10.5px;margin:0 0 3px;color:#16452e!important;break-after:avoid;page-break-after:avoid}.report-event-heading-main{min-width:0}.report-event-meta{font-size:8px;color:#5d6e61}.report-event-tag{font-size:7.5px;font-weight:bold;color:#705d26;text-align:right;flex:0 0 auto}.report-event-notes,.report-event-status{padding:7px 9px;color:#53685b;font-size:8px;white-space:pre-wrap}.report-event-table{margin:0!important;border:0}.report-event-table th{background:#e9efe5!important;color:#2e4d39!important}.report-event-table td{padding:4px 6px!important}.report-event-table .report-col-number{width:28px}.report-event-author{font-size:7.5px;color:#53685b}.report-no-marches,.report-empty{padding:8px 10px;color:#718173;font-style:italic;font-size:8.5px}@media print{.report-date-heading,.report-event-heading{break-after:avoid!important;page-break-after:avoid!important}.report-event-block{break-inside:avoid-page;page-break-inside:avoid}.report-date-group{break-inside:auto;page-break-inside:auto}}}`}

  function bmmPrintObjectReport(title,body){const orientation=bmmReportOrientation==='landscape'?'landscape':'portrait';const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${bmmPrintCss(orientation)}</style></head><body>${body}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\\/script>
<style id="bmm-analytics-dark-contrast-a4-v1">
/* Analítica y componentes heredados: superficies oscuras, texto claro y contraste consistente. */
html[data-bmm-resolved-theme="dark"] .content :is(.bar-label,.bar-value,.mini-bar-label,.mini-bar-count,.timeline-year,.timeline-date,.timeline-march,.timeline-march b,.group-stat,.group-stat strong,.group-stat span,.author-count,.author-avatar,.legend-line,.report-check,.insight-row,.insight-row strong,.insight-row span,.insight-icon,.quick-action,.quick-action strong,.quick-action span,.status-realizado,.status-planificado,.status-cancelado,.status-sin-confirmar,.no-data-pill){color:var(--bmm-text)!important}
html[data-bmm-resolved-theme="dark"] .content :is(.bar-track,.chart-empty,.timeline-item,.timeline-date,.timeline-march,.timeline-march b,.group-stat,.author-avatar,.report-check,.insight-row,.insight-icon,.quick-action,.quick-action .qa-icon,.no-data-pill,.status-realizado,.status-planificado,.status-cancelado,.status-sin-confirmar){background:var(--bmm-raised)!important;border-color:var(--bmm-border)!important;box-shadow:none!important}
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-item,.timeline-march,.timeline-date,.group-tile,.group-stat,.author-row,.author-avatar,.insight-row,.quick-action,.report-check,.bar-track,.mini-chart,.chart-empty){color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-item h3,.group-tile h3,.group-stat strong,.author-meta strong,.author-count,.rank-name,.rank-count,.bar-value,.insight-row strong,.quick-action strong){color:#f3f7f3!important}
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-meta,.group-tile p,.group-stat span,.author-meta span,.mini-bar-label,.mini-bar-count,.bar-label,.legend-line,.insight-row span,.quick-action span,.report-check){color:#c8d8cd!important}
html[data-bmm-resolved-theme="dark"] .content .timeline-date strong{color:#f4f8f4!important}html[data-bmm-resolved-theme="dark"] .content .timeline-date span{color:#c8d8cd!important}
html[data-bmm-resolved-theme="dark"] .content .timeline-march b{background:#263f2e!important;color:#f4f8f4!important}
html[data-bmm-resolved-theme="dark"] .content .bar-track{background:#263b2d!important}html[data-bmm-resolved-theme="dark"] .content .bar-fill{background:linear-gradient(90deg,#5bc58a,#a9e4bb)!important}
html[data-bmm-resolved-theme="dark"] .content .mini-bar{background:linear-gradient(180deg,#efd27b,#58bf85)!important}html[data-bmm-resolved-theme="dark"] .content .mini-chart{border-color:var(--bmm-border)!important}
html[data-bmm-resolved-theme="dark"] .content :is(.group-stat,.insight-row,.report-check,.quick-action,.timeline-item,.timeline-march,.timeline-date,.author-avatar){background:var(--bmm-surface)!important}
html[data-bmm-resolved-theme="dark"] .content .author-avatar{color:#e8f4eb!important}
html[data-bmm-resolved-theme="dark"] .content .status-realizado{background:#1d4b32!important;color:#d7f7df!important}html[data-bmm-resolved-theme="dark"] .content .status-planificado{background:#493b1b!important;color:#ffedb5!important}html[data-bmm-resolved-theme="dark"] .content .status-cancelado{background:#4c2828!important;color:#ffd0cc!important}html[data-bmm-resolved-theme="dark"] .content .status-sin-confirmar{background:#28372d!important;color:#d4e0d6!important}
html[data-bmm-resolved-theme="dark"] .content :is(.data-table th,.audit-table th){background:#1a3223!important;color:#d7e5da!important}html[data-bmm-resolved-theme="dark"] .content :is(.data-table td,.audit-table td){background:transparent!important;color:#eef5ef!important}
</style>


<style id="bmm-sidebar-history-v15">
/* A single dark brand rail is used in both themes; the content theme remains independent. */
html[data-bmm-resolved-theme="light"] .sidebar,
html[data-bmm-resolved-theme="dark"] .sidebar {
  background:linear-gradient(160deg,#0c3829 0%,#082a1e 58%,#061e15 100%)!important;
  color:#f3f8f3!important;border-right:1px solid #315343!important;
}
html[data-bmm-resolved-theme] .sidebar .brand-name,
html[data-bmm-resolved-theme] .sidebar .nav button,
html[data-bmm-resolved-theme] .sidebar .sidebar-bottom {color:#eef6ef!important;}
html[data-bmm-resolved-theme] .sidebar .brand-sub {color:#c8d9cc!important;}
html[data-bmm-resolved-theme] .sidebar .nav-label {color:#e1cb7c!important;}
html[data-bmm-resolved-theme] .sidebar .nav button:hover {background:rgba(255,255,255,.09)!important;color:#fff!important;}
html[data-bmm-resolved-theme] .sidebar .nav button.active {color:#fff!important;background:linear-gradient(105deg,#1a714a,#0c4930)!important;border-color:#d8bf69!important;}
html[data-bmm-resolved-theme] .sidebar .sidebar-admin-btn {display:flex;align-items:center;gap:9px;width:100%;margin-top:8px;padding:9px 10px;border-radius:10px;border:1px solid #62816c;background:rgba(255,255,255,.06);color:#f1f7f2!important;text-align:left;font-size:11px;font-weight:700;}
html[data-bmm-resolved-theme] .sidebar .sidebar-admin-btn:hover {background:rgba(255,255,255,.13);border-color:#d8bf69;}
html[data-bmm-resolved-theme] .sidebar .sidebar-versionline {margin-top:9px;color:#cad9ce!important;font-size:10px;}
html[data-bmm-resolved-theme] .sidebar .sidebar-status {color:#f0f6f1!important;}
.bmm-version-current{display:flex;align-items:flex-start;gap:13px;padding:15px;border:1px solid var(--bmm-border,#d5dfd5);border-radius:14px;background:linear-gradient(135deg,rgba(40,120,78,.13),rgba(201,169,80,.08));margin-bottom:16px;color:var(--bmm-text,#173629)}
.bmm-version-current h3{margin:4px 0;font-size:16px;color:inherit}.bmm-version-current p,.bmm-modal-help{margin:4px 0 0;color:var(--bmm-muted,#596e60);font-size:12px;line-height:1.55}.bmm-version-current small{font-size:9px;font-weight:800;letter-spacing:1.3px;color:var(--bmm-muted,#596e60)}
.bmm-version-mark{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:12px;background:linear-gradient(140deg,#1b7049,#0c432e);color:#fff!important;font-size:19px;font-weight:800;border:1px solid #c9ac55}
.bmm-version-timeline{display:grid;gap:0}.bmm-version-entry{display:grid;grid-template-columns:18px minmax(0,1fr);gap:10px;position:relative;padding:0 0 15px}.bmm-version-rail{position:relative;display:flex;justify-content:center}.bmm-version-rail:after{content:'';position:absolute;top:13px;bottom:-5px;width:2px;background:var(--bmm-border,#d5dfd5)}.bmm-version-entry:last-child .bmm-version-rail:after{display:none}.bmm-version-rail span{position:relative;z-index:1;display:block;width:12px;height:12px;border-radius:50%;background:#246f49;border:3px solid var(--bmm-surface,#fffefa);box-shadow:0 0 0 1px #b9c99b;margin-top:4px}.bmm-version-entry-main{min-width:0;border:1px solid var(--bmm-border,#d5dfd5);border-radius:12px;padding:12px;background:var(--bmm-surface,#fffefa);color:var(--bmm-text,#173629)}.bmm-version-entry-top{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;flex-wrap:wrap}.bmm-version-entry-top strong{font-size:13px;color:inherit}.bmm-version-entry-top time{font-size:10px;color:var(--bmm-muted,#596e60)}.bmm-version-entry-main ul{margin:9px 0 0;padding-left:18px;color:var(--bmm-muted,#596e60);font-size:12px;line-height:1.55}.bmm-version-entry-main li+li{margin-top:3px}.bmm-version-badge{display:inline-block;margin-top:7px;padding:3px 8px;border-radius:999px;background:#d9eee0;color:#185638;font-size:10px;font-weight:800}
.bmm-version-device{border-top:1px solid var(--bmm-border,#d5dfd5);margin-top:10px;padding-top:12px}.bmm-version-device h3{font-size:13px;margin:0;color:var(--bmm-text,#173629)}.bmm-version-device>p{color:var(--bmm-muted,#596e60);font-size:11px;line-height:1.5}
.bmm-version-history-card{margin-top:18px}.bmm-version-summary{display:flex;gap:11px;align-items:center;flex-wrap:wrap}.bmm-version-summary>div{flex:1;min-width:120px}.bmm-version-summary strong,.bmm-version-summary small{display:block}.bmm-version-summary strong{color:var(--bmm-text,#173629);font-size:13px}.bmm-version-summary small{color:var(--bmm-muted,#596e60);font-size:11px;margin-top:3px}.bmm-audit-modal-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:9px}.bmm-audit-modal-table{max-height:min(58vh,620px);overflow:auto;margin-top:12px;border:1px solid var(--bmm-border,#d5dfd5);border-radius:10px}
html[data-bmm-resolved-theme="dark"] .bmm-version-current{background:linear-gradient(135deg,#143a27,#182d20 58%,#302a16);border-color:#355743;color:#eef6ef}
html[data-bmm-resolved-theme="dark"] .bmm-version-current p,html[data-bmm-resolved-theme="dark"] .bmm-version-current small,html[data-bmm-resolved-theme="dark"] .bmm-modal-help{color:#c8d9ce}
html[data-bmm-resolved-theme="dark"] .bmm-version-entry-main{background:linear-gradient(145deg,#142b1d,#0b1d13);border-color:#355743;color:#eef6ef}
html[data-bmm-resolved-theme="dark"] .bmm-version-entry-main ul,html[data-bmm-resolved-theme="dark"] .bmm-version-entry-top time,html[data-bmm-resolved-theme="dark"] .bmm-version-device>p{color:#c8d9ce}
html[data-bmm-resolved-theme="dark"] .bmm-version-device h3,html[data-bmm-resolved-theme="dark"] .bmm-version-summary strong{color:#f1f7f2}
html[data-bmm-resolved-theme="dark"] .bmm-version-summary small{color:#c8d9ce}
html[data-bmm-resolved-theme="light"] .bmm-version-entry-main{background:linear-gradient(145deg,#fffefa,#f2f6ef);color:#173629}
@media(max-width:760px){.bmm-version-entry-top{display:grid}.bmm-audit-modal-table{max-height:52vh}.sidebar .sidebar-admin-btn{min-height:39px}}
</style>

</body></html>`;const w=window.open('','_blank');if(!w){download(`${bmmSafeName(title)}.html`,html,'text/html;charset=utf-8');showToast('El navegador bloqueó la ventana. Se descargó el informe HTML.',true);return;}w.document.open();w.document.write(html);w.document.close();}
  function bmmReportTitleFor(type){return ({full:'Informe general · BMM Santa Cecilia',events:'Informe de actuaciones',timeline:'Cronología de la banda',repertoire:'Catálogo y frecuencia de marchas',analytics:'Informe analítico musical',groups:'Informe de grupos de eventos'})[type]||'Informe BMM Santa Cecilia';}
  function bmmUpdatePreview(){const slot=document.getElementById('reportPreviewDocument');if(!slot)return;const type=bmmReportType==='full'?'full':bmmReportType;const events=bmmCurrentReportEvents();slot.innerHTML=bmmReportContent(type,bmmReportOutputTitle(bmmReportTitle||bmmReportTitleFor(type)),events);const count=document.getElementById('reportPreviewCount');if(count)count.textContent=`${events.length} eventos · ${totalPlays(events)} interpretaciones`;const note=document.getElementById('reportScopeNote');if(note)note.textContent=bmmScopeDescription||'El informe utiliza el conjunto de datos y los filtros seleccionados.';}
  renderReports = function(){
    const events=getReportFilteredEvents();const selected=bmmReportEvents();const years=bmmUniq(state.events.map(bmmYear)).filter(x=>x!=='Sin año').sort().reverse();const groups=bmmUniq([...state.groupsCatalog.map(g=>g.name),...state.events.map(bmmGroup)]).sort((a,b)=>a.localeCompare(b,'es'));
    const title=bmmReportTitle||bmmReportTitleFor(bmmReportType);const outputTitle=bmmReportOutputTitle(title);const docEvents=['repertoire','analytics','groups'].includes(bmmReportType)?bmmCurrentReportEvents():selected;
    return `${bmmHeader('Informes para dirección','Centro de informes','Filtra, selecciona, previsualiza y exporta documentos A4. Cada tipo de informe puede generarse de manera independiente o como dossier completo.',`<button class="btn btn-soft" data-action="export-json">⇩ Copia JSON</button><button class="btn btn-soft" data-action="share-report-pdf">↗ Compartir PDF</button><button class="btn btn-primary" data-action="print-report-preview">Imprimir / guardar PDF</button>`)}
      <section class="pro-card" style="margin-bottom:17px"><div class="pro-card-head"><div><h2>1 · Construye el informe</h2><p>Combina criterios y selecciona actuaciones concretas sin perder la libertad de selección manual.</p></div><span class="pill gold">${events.length} resultados</span></div><div class="pro-card-body"><div class="filter-panel" style="padding:0;border:0;margin:0 0 14px"><div class="field"><label>Buscar</label><input id="reportSearch" type="search" value="${esc(reportSearch)}" placeholder="Evento, grupo, localidad o marcha…"></div><div class="field"><label>Año</label><select id="reportYear"><option value="all">Todos los años</option>${years.map(y=>`<option value="${esc(y)}" ${reportYear===y?'selected':''}>${esc(y)}</option>`).join('')}</select></div><div class="field"><label>Grupo / campaña</label><select id="reportGroup"><option value="all">Todos los grupos</option>${groups.map(g=>`<option value="${esc(g)}" ${reportGroup===g?'selected':''}>${esc(g)}</option>`).join('')}</select></div><div class="field"><label>Tipo de evento</label><select id="reportCategory"><option value="all">Todos los tipos</option>${state.categories.map(c=>`<option value="${esc(c)}" ${reportCategory===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label>Desde</label><input id="reportFrom" type="date" value="${esc(reportFrom)}"></div><div class="field"><label>Hasta</label><input id="reportTo" type="date" value="${esc(reportTo)}"></div><div class="field"><label>Tipo de documento</label><select id="reportType">${[['events','Actuaciones e interpretaciones'],['timeline','Cronología de eventos'],['repertoire','Catálogo de marchas'],['analytics','Informe analítico / indicadores'],['groups','Grupos de eventos'],['full','Dossier general completo']].map(([v,l])=>`<option value="${esc(v)}" ${bmmReportType===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>Orientación del PDF</label><select id="reportOrientation"><option value="portrait" ${bmmReportOrientation==='portrait'?'selected':''}>A4 vertical</option><option value="landscape" ${bmmReportOrientation==='landscape'?'selected':''}>A4 horizontal</option></select></div></div>
      <div class="field" style="margin-bottom:12px"><label for="reportTitle">Título del documento</label><input id="reportTitle" value="${esc(title)}" maxlength="160" placeholder="Título personalizado para dirección"><small style="color:var(--muted)">La fecha de generación ya aparece en la cabecera del informe.</small></div>
      <div class="report-config-grid"><label class="report-check"><input id="reportIncludeDateInTitle" type="checkbox" ${bmmReportIncludeDateInTitle?'checked':''}> Añadir fecha al título y al nombre del archivo</label><label class="report-check"><input id="reportIncludeStats" type="checkbox" ${bmmReportIncludeStats?'checked':''}> Incluir indicadores de resumen</label><label class="report-check"><input id="reportIncludeAuthors" type="checkbox" ${bmmReportIncludeAuthors?'checked':''}> Incluir autores de las marchas</label><label class="report-check"><input id="reportIncludeNotes" type="checkbox" ${bmmReportIncludeNotes?'checked':''}> Incluir notas y observaciones</label></div>
      <div class="insight-row" style="margin-top:8px"><div class="insight-icon">⌖</div><div><strong>Alcance del informe</strong><span id="reportScopeNote">${esc(bmmScopeDescription||'El informe utiliza el conjunto de datos y los filtros seleccionados.')}</span></div>${bmmScopeDescription?'<button class="btn btn-soft btn-small" data-action="clear-report-scope">Usar todo el conjunto</button>':''}</div><div class="section-toolbar" style="margin-top:14px"><button class="btn btn-soft btn-small" data-action="select-all-report">Seleccionar todos los eventos filtrados</button><button class="btn btn-soft btn-small" data-action="clear-report-selection">Desmarcar todos</button><button class="btn btn-soft btn-small" data-action="clear-report-filters">Limpiar filtros</button><span class="spacer"></span><span id="reportSelectionCount" class="pill gold">${selected.length} eventos seleccionados</span></div>
      <div class="report-selection-bar" style="border:1px solid #e2e9df;border-radius:13px;overflow:hidden"><div class="table-wrap"><table class="data-table"><thead><tr><th>Incluir</th><th>Fecha</th><th>Evento</th><th>Grupo</th><th>Marchas</th></tr></thead><tbody>${events.map(e=>`<tr><td><input type="checkbox" data-report-event="${esc(e.id)}" ${(reportSelectionTouched?selectedReportEvents.has(e.id):true)?'checked':''} aria-label="Incluir ${esc(e.name)}"></td><td>${fmtDate(e.date,{day:'2-digit',month:'short',year:'numeric'})}${e.time?' · '+esc(e.time):''}</td><td><strong>${esc(e.name)}</strong><br><span class="secondary-cell">${esc(e.category)} · ${esc(bmmStatus(e))}</span></td><td>${esc(bmmGroup(e))}</td><td>${(e.marches||[]).length}</td></tr>`).join('')||'<tr><td colspan="5"><div class="chart-empty">No hay eventos que coincidan con los filtros.</div></td></tr>'}</tbody></table></div></div></div></section>
      <section class="pro-card"><div class="pro-card-head"><div><h2>2 · Previsualización del documento</h2><p>La vista previa muestra el contenido que irá al documento. Revisa el título, los filtros y los datos antes de imprimir.</p></div><div class="section-toolbar"><button class="btn btn-soft btn-small" data-action="export-report-html">Descargar HTML</button><button class="btn btn-soft btn-small" data-action="share-report-pdf">↗ Compartir PDF</button><button class="btn btn-primary btn-small" data-action="print-report-preview">Imprimir / guardar PDF</button></div></div><div class="pro-card-body"><div class="report-preview-caption"><span>PREVISUALIZACIÓN · PAPEL A4</span><span id="reportPreviewCount">${selected.length} eventos · ${totalPlays(selected)} interpretaciones</span></div><div class="report-preview-shell"><div id="reportPreviewDocument">${bmmReportContent(bmmReportType,outputTitle,docEvents)}</div></div></div></section>
      <section class="pro-grid" style="margin-top:17px"><div class="span-4"><div class="pro-card"><div class="pro-card-head"><div><h2>Exportar los datos</h2><p>Para análisis posterior</p></div></div><div class="pro-card-body"><div class="backup-row"><div><strong>CSV de actuaciones</strong><span>Compatible con Excel y hojas de cálculo.</span></div><button class="btn btn-soft btn-small" data-action="export-csv">CSV</button></div><div class="backup-row"><div><strong>JSON completo</strong><span>Copia para restaurar todos los registros.</span></div><button class="btn btn-soft btn-small" data-action="export-json">JSON</button></div><div class="backup-row"><div><strong>HTML del informe</strong><span>Documento portable con diseño y tablas.</span></div><button class="btn btn-soft btn-small" data-action="export-report-html">HTML</button></div></div></div></div><div class="span-8"><div class="pro-card"><div class="pro-card-head"><div><h2>Dossier general</h2><p>Incluye el catálogo, estadísticas, grupos y las actuaciones con sus marchas.</p></div><span class="pill gold">Todos los datos</span></div><div class="pro-card-body"><p style="color:var(--muted);font-size:12px;margin-top:0">Para una entrega integral, selecciona «Dossier general completo». Los informes parciales mantienen los filtros y selección de eventos.</p><button class="btn btn-primary" data-action="set-full-report">Preparar dossier general</button></div></div></div></section>`;
  };

  function bmmReportHtmlFull(type, title, events){
    const body=bmmReportContent(type,title,events);
    const orientation=bmmReportOrientation==='landscape'?'landscape':'portrait';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${bmmPrintCss(orientation)}
/* Identidad oficial BMM Santa Cecilia: verde, oro y marfil. */
:root{--ink:#17372a;--muted:#758278;--bg:#f4f6f0;--paper:#fffef9;--nav:#082f22;--nav2:#155237;--red:#17613e;--red2:#26784c;--gold:#cfb45d;--line:#e0e7dc;--green:#286f4c;--shadow:0 12px 32px rgba(10,44,30,.07);--radius:19px}
.brand-mark{padding:2px!important;overflow:hidden!important;background:#fff!important;border:1px solid #d4bb66!important;border-radius:13px!important;flex:0 0 auto}
.brand-mark img{display:block;width:100%;height:100%;object-fit:cover;border-radius:10px}
.topbar-crest{width:42px;height:42px;flex:0 0 42px;object-fit:contain;background:#fff;border:1px solid #d4bb66;border-radius:50%;padding:2px;box-shadow:0 4px 14px #173b2a0c}
.topbar{gap:13px!important}.topbar>div:first-of-type{min-width:0;flex:1}
.btn-primary{background:linear-gradient(135deg,#1c7048,#0e4b30)!important;color:#fff!important}
.nav button.active{background:linear-gradient(105deg,#1f6b45,#104b31)!important;border-color:#d2b95f88!important}
.event-datebox{background:#eaf2e7!important;color:#1b6842!important}.pill.red{background:#e8f2e5!important;color:#20623c!important}
.member-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:14px 0 20px}
.member-card{border:1px solid #e0e8dc;border-radius:17px;background:linear-gradient(145deg,#fffefa,#f8faf4);padding:16px;min-width:0;box-shadow:0 8px 22px #143d2a07;transition:transform .18s,box-shadow .18s}
.member-card:hover{transform:translateY(-2px);box-shadow:0 14px 28px #143d2a10}
.member-card-head{display:flex;gap:11px;align-items:center;min-width:0}
.member-avatar{width:45px;height:45px;flex:0 0 45px;border-radius:15px;background:linear-gradient(145deg,#e9f1e5,#d6e4d1);border:1px solid #d3e0cf;color:#155b38;display:grid;place-items:center;font:700 15px Georgia,serif}
.member-heading{min-width:0;flex:1}.member-heading h3{margin:0 0 4px;font-size:14px;overflow-wrap:anywhere}.member-heading p{margin:0;color:#708075;font-size:11px;overflow-wrap:anywhere}
.member-status{display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:99px;font-size:9px;font-weight:800;background:#e6f3e8;color:#20643c;white-space:nowrap}.member-status.inactive{background:#f2eee3;color:#806629}.member-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:14px 0 12px}
.member-fact{border:1px solid #e7ede2;background:#f7f9f3;border-radius:10px;padding:9px;min-width:0}.member-fact strong{font-size:15px;color:#205b39;display:block;overflow-wrap:anywhere}.member-fact span{font-size:9px;color:#7a887c;display:block;margin-top:3px}
.member-meta{font-size:10px;color:#718176;display:flex;flex-wrap:wrap;gap:8px;overflow-wrap:anywhere}.member-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:13px;padding-top:11px;border-top:1px solid #e8eee5}.member-instrument-chip{display:inline-flex;padding:5px 9px;background:#edf4e9;border:1px solid #dfebd9;color:#2c6240;border-radius:999px;font-size:10px;font-weight:750}
.member-empty{padding:35px 22px;text-align:center;background:#fffefb;border:1px dashed #d6e1d2;border-radius:16px;color:#738177;grid-column:1/-1}.member-empty strong{display:block;color:#214c32;font-size:15px;margin-bottom:5px}
.member-form-note{padding:10px 12px;background:#f3f7ef;color:#64786a;border-radius:10px;font-size:11px;margin-top:10px}
@media(max-width:760px){.topbar-crest{width:34px;height:34px;flex-basis:34px}.member-grid{grid-template-columns:1fr}.member-facts{grid-template-columns:repeat(3,minmax(0,1fr))}.member-card{padding:14px}.member-actions .btn{flex:1}.brand-mark{width:38px!important;height:38px!important}}
@media(max-width:440px){.topbar-crest{display:none}.member-facts{gap:5px}.member-fact{padding:8px}.member-fact strong{font-size:13px}}

.login-check-shell{grid-template-columns:1fr!important;background:#f5f6ef!important;color:#18372b!important;place-items:center}.login-check-shell .login-card-wrap{width:min(92vw,520px);min-height:0;background:transparent;padding:20px}.login-check-shell .login-card{width:100%;text-align:center}.login-check-shell .login-crest{display:block;margin:0 auto 18px}

/* BMM responsive refinement v2 — mobile/tablet/desktop */
html{max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%}
body{min-width:0;max-width:100%;overflow-x:hidden}
.app,.main,.content,.page,.page-content,.pro-grid,.dashboard-grid,.config-grid,.card,.pro-card,.member-card,.chart-card{min-width:0;max-width:100%}
img,svg,canvas{max-width:100%}
.topbar{min-width:0;max-width:100%;flex-wrap:wrap}
.topbar>div,.topbar-ident,.top-title,.top-actions,.top-right{min-width:0;max-width:100%}
.top-title,.topbar-ident h1,.topbar-ident h2{overflow-wrap:anywhere}
/* Charts and visual cards must shrink with their grid cell. */
.chart-wrap,.chart-container,.chart-area,.chart-svg,.chart-scroll,.pro-chart,.bar-chart,.timeline-chart{width:100%;min-width:0;max-width:100%;overflow:hidden}
.pro-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}
.pro-grid>[class*="span-"]{min-width:0}
.pro-kpi{min-width:0;overflow:hidden}
.pro-kpi-label,.pro-kpi-meta{overflow-wrap:anywhere}
.pro-kpi-value{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.filter-panel,.global-filterbar,.report-tools{min-width:0}
.filter-panel .field,.global-filterbar .field,.report-tools .field{min-width:0}
.filter-panel input,.filter-panel select,.global-filterbar input,.global-filterbar select,.report-tools input,.report-tools select{width:100%;min-width:0;max-width:100%}
.section-toolbar{min-width:0;flex-wrap:wrap;gap:7px}
.section-toolbar .btn{max-width:100%;white-space:normal}
.member-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.member-card{min-width:0;overflow:hidden}
.member-facts{grid-template-columns:repeat(3,minmax(0,1fr))}
.member-fact{min-width:0;overflow:hidden}
.member-fact strong,.member-fact span{overflow-wrap:anywhere;word-break:normal}
/* Bottom navigation: one compact, swipeable row instead of squeezing nine items into five columns. */
@media(max-width:760px){
  .app{display:block;min-height:100dvh}
  .sidebar{position:fixed!important;z-index:50!important;left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100%!important;height:auto!important;min-height:0!important;padding:6px 7px calc(6px + env(safe-area-inset-bottom))!important;border-radius:15px 15px 0 0!important;overflow:hidden!important}
  .brand,.nav-label,.sidebar-bottom{display:none!important}
  .nav{display:flex!important;flex-flow:row nowrap!important;align-items:stretch;gap:5px!important;width:100%;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:0 1px 2px!important}
  .nav::-webkit-scrollbar{display:none}
  .nav button{display:flex!important;flex:0 0 66px!important;min-width:66px!important;max-width:66px!important;min-height:53px;flex-direction:column!important;align-items:center;justify-content:center;text-align:center!important;gap:3px!important;padding:5px 3px!important;border-radius:10px!important;font-size:9px!important;line-height:1.1!important;white-space:normal!important;overflow-wrap:anywhere}
  .nav-icon{font-size:18px!important;line-height:1!important;width:auto!important}
  .nav button.active{box-shadow:none!important}
  .content{padding:18px 12px calc(88px + env(safe-area-inset-bottom))!important;min-width:0!important}
  .topbar{padding:11px 12px!important;gap:8px!important;min-height:64px}
  .topbar-ident{gap:7px!important;flex:1 1 160px;min-width:0}
  .topbar-crest{width:34px!important;height:34px!important;flex:0 0 34px!important;display:block!important}
  .topbar-kicker{font-size:7px!important;letter-spacing:.45px!important;overflow-wrap:anywhere}
  .topbar-ident h1,.topbar-ident h2,.top-title{font-size:13px!important;line-height:1.2}
  .top-actions,.top-right{gap:5px!important;flex:0 1 auto;max-width:100%;flex-wrap:wrap;justify-content:flex-end}
  .top-actions .btn,.top-right .btn{font-size:10px!important;padding:8px 9px!important;min-height:34px;white-space:normal}
  .cloud-state,.date-today{display:none!important}
  .page-head{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin-bottom:16px}
  .page-head h1{font-size:clamp(24px,7vw,30px)!important;line-height:1.12;overflow-wrap:anywhere}
  .page-head p{font-size:12px;line-height:1.5}
  .page-head .btn{width:100%;justify-content:center}
  .stats{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
  .stat-card{min-width:0!important;padding:12px!important;overflow:hidden}
  .stat-value{font-size:clamp(21px,6vw,28px)!important;margin-top:8px!important;overflow-wrap:anywhere}
  .stat-top{font-size:9px!important;line-height:1.3}
  .stat-icon{width:28px!important;height:28px!important;flex:0 0 28px}
  .pro-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
  .pro-grid>.span-12,.pro-grid>.span-8,.pro-grid>.span-7,.pro-grid>.span-6,.pro-grid>.span-5,.pro-grid>.span-4,.pro-grid>.span-3,.pro-grid>[class*="span-"]{grid-column:span 2!important}
  .pro-grid>.pro-kpi,.pro-grid>.span-3.pro-kpi,.pro-grid>.span-4.pro-kpi{grid-column:span 1!important}
  .pro-kpi{padding:11px!important;border-radius:13px!important}
  .pro-kpi-label{font-size:9px!important;line-height:1.35;display:flex;align-items:center;gap:5px}
  .pro-kpi-value{font-size:clamp(22px,6.5vw,29px)!important;line-height:1.15;margin:8px 0 3px!important}
  .pro-kpi-meta{font-size:9px!important;line-height:1.35}
  .pro-card{border-radius:15px!important}
  .pro-card-head,.card-head{padding:13px 13px 10px!important;gap:8px;flex-wrap:wrap}
  .pro-card-head h2,.card-head h2{font-size:14px!important;overflow-wrap:anywhere}
  .pro-card-head p{font-size:10px!important;line-height:1.45}
  .pro-card-body,.card-body{padding:12px 13px 14px!important;min-width:0}
  .bar-item{grid-template-columns:minmax(62px,.9fr) minmax(45px,1.3fr) 24px!important;gap:6px!important}
  .bar-label,.bar-value{font-size:9px!important;overflow-wrap:anywhere}
  .filter-panel{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;padding:10px!important;border-radius:14px!important}
  .filter-panel .field{grid-column:auto!important}
  .filter-panel .field:has(input[type="search"]){grid-column:1/-1!important}
  .filter-panel label{font-size:9px!important}
  .filter-panel input,.filter-panel select{font-size:12px!important;min-height:39px;padding:8px 9px!important}
  .global-filterbar{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;padding:10px!important}
  .global-filterbar .global-search,.global-filterbar .global-filter-title{grid-column:1/-1!important}
  .global-filterbar .global-filter-title{display:flex;flex-direction:column;align-items:flex-start}
  .section-toolbar{display:flex;align-items:center;gap:6px!important;margin:10px 0!important}
  .section-toolbar .pill{font-size:9px!important;max-width:100%;white-space:normal}
  .section-toolbar .spacer{display:none!important}
  .section-toolbar .btn{flex:1 1 42%;font-size:10px!important;padding:8px!important}
  .member-grid{grid-template-columns:minmax(0,1fr)!important;gap:10px!important}
  .member-facts{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}
  .member-fact{padding:7px 6px!important}
  .member-fact strong{font-size:13px!important;line-height:1.2}
  .member-fact span{font-size:8px!important;line-height:1.25}
  .member-card-head{gap:8px!important;flex-wrap:wrap}
  .member-status{font-size:8px!important}
  .member-actions{justify-content:stretch!important}
  .member-actions .btn{flex:1 1 38%;font-size:10px!important;padding:8px!important}
  .timeline{padding-left:15px!important}
  .timeline-item{padding:11px!important;min-width:0}
  .timeline-date{min-width:42px!important}
  .event-card-head{padding:11px!important;flex-wrap:wrap}
  .event-card-actions{flex-direction:row!important;flex-wrap:wrap}
  .event-card-actions .btn{flex:1 1 auto}
  .march-line{grid-template-columns:22px minmax(0,1fr) auto!important;gap:6px!important}
  .data-table{min-width:540px}
  .table-wrap,.table-scroll{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .report-preview-shell{padding:7px!important;overflow-x:auto!important}
  .report-preview-document,.report-doc{min-width:0!important;width:100%!important}
  .report-doc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .modal-backdrop{padding:0!important;align-items:flex-end!important}
  .modal,.modal.small{width:100%!important;max-width:100%!important;max-height:92dvh!important;border-radius:18px 18px 0 0!important}
  .modal-content{overflow-y:auto;overscroll-behavior:contain}
  .toast{left:10px!important;right:10px!important;bottom:calc(76px + env(safe-area-inset-bottom))!important}
}
@media(max-width:390px){
  .nav button{flex-basis:61px!important;min-width:61px!important;max-width:61px!important;font-size:8px!important}
  .content{padding-left:10px!important;padding-right:10px!important}
  .pro-grid{gap:8px!important}
  .pro-kpi{padding:9px!important}
  .pro-kpi-label{font-size:8px!important}
  .pro-kpi-meta{font-size:8px!important}
  .filter-panel{gap:7px!important;padding:9px!important}
  .filter-panel input,.filter-panel select{font-size:11px!important;padding:7px!important}
  .member-facts{grid-template-columns:repeat(3,minmax(0,1fr))!important}
}
@media(min-width:761px) and (max-width:1100px){
  .pro-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
  .pro-grid>.span-8,.pro-grid>.span-7{grid-column:span 6}
  .pro-grid>.span-6,.pro-grid>.span-5,.pro-grid>.span-4,.pro-grid>.span-3{grid-column:span 3}
  .member-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}


/* Navegación móvil BMM: cuatro accesos frecuentes y un menú «Más» en una hoja compacta. */
.bmm-more-trigger{display:none!important}
.bmm-more-backdrop{display:none;position:fixed;inset:0;z-index:100;background:rgba(4,24,16,.42);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);align-items:flex-end;justify-content:center;padding:12px 12px calc(88px + env(safe-area-inset-bottom));}
.bmm-more-backdrop.open{display:flex;animation:bmmBackdropIn .16s ease-out}
.bmm-more-sheet{width:min(100%,540px);max-height:min(62dvh,560px);overflow:auto;border:1px solid #d9e4d7;border-radius:22px;background:#fffefa;box-shadow:0 18px 70px rgba(4,35,22,.26);padding:18px;animation:bmmSheetIn .2s ease-out;overscroll-behavior:contain}
.bmm-more-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:13px;margin-bottom:13px;border-bottom:1px solid #e8ede4}
.bmm-more-kicker{font-size:9px;font-weight:850;letter-spacing:1.5px;color:#a18431}
.bmm-more-head h2{font:700 24px/1.1 Georgia,serif;color:#153d2a;margin:5px 0}
.bmm-more-head p{font-size:12px;color:#78867c;margin:0;line-height:1.45}
.bmm-more-close{flex:0 0 38px;width:38px;height:38px;border:1px solid #dfe7dd;background:#f3f6ef;border-radius:12px;color:#294b35;font-size:25px;line-height:1;cursor:pointer}
.bmm-more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.bmm-more-link{display:flex;align-items:center;gap:10px;min-width:0;min-height:60px;padding:10px 11px;border:1px solid #e0e8dd;border-radius:13px;background:linear-gradient(135deg,#fffefa,#f5f8f1);color:#214a31;text-align:left;font:650 13px/1.25 system-ui,-apple-system,sans-serif;cursor:pointer;transition:background .16s,border-color .16s,transform .16s}
.bmm-more-link:hover,.bmm-more-link:focus-visible{border-color:#c6ad57;background:#edf4e9;outline:none}
.bmm-more-link.active{background:#e5efe2;border-color:#b8cda9;box-shadow:inset 3px 0 #1b6641}
.bmm-more-icon{display:grid;place-items:center;flex:0 0 36px;width:36px;height:36px;border-radius:11px;background:#e9f0e4;color:#1c6541;font-size:19px}
.bmm-more-link>span:nth-child(2){flex:1;overflow-wrap:anywhere}
.bmm-more-arrow{color:#9a8746;font-size:23px;line-height:1}
.bmm-more-foot{font-size:10px;line-height:1.45;color:#839087;margin:13px 2px 1px}
@keyframes bmmBackdropIn{from{opacity:0}to{opacity:1}}
@keyframes bmmSheetIn{from{transform:translateY(16px);opacity:.82}to{transform:translateY(0);opacity:1}}
@media(max-width:760px){
  .sidebar{padding:7px 7px calc(7px + env(safe-area-inset-bottom))!important;border-radius:17px 17px 0 0!important;box-shadow:0 -8px 28px rgba(9,47,31,.12)!important;overflow:visible!important}
  .nav{display:flex!important;flex-flow:row nowrap!important;align-items:stretch!important;justify-content:space-between!important;gap:4px!important;width:100%!important;overflow:visible!important;padding:0!important}
  .nav button[data-mobile-secondary="true"]{display:none!important}
  .nav button[data-mobile-primary="true"],.nav .bmm-more-trigger{display:flex!important;flex:1 1 0!important;width:auto!important;min-width:0!important;max-width:none!important;min-height:59px!important;height:59px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:5px 2px!important;border:1px solid transparent!important;border-radius:12px!important;background:transparent!important;color:#c8d7cd!important;font-size:10px!important;line-height:1.1!important;font-weight:600!important;white-space:normal!important;overflow-wrap:normal!important;transform:none!important;box-shadow:none!important}
  .nav .nav-icon{display:block!important;font-size:19px!important;line-height:1!important;width:auto!important;min-width:0!important;color:inherit!important}
  .nav .nav-label-text{display:block!important;max-width:100%;font-size:10px!important;line-height:1.05!important;white-space:nowrap!important;letter-spacing:-.15px!important}
  .nav button[data-mobile-primary="true"].active,.nav .bmm-more-trigger.active{background:linear-gradient(135deg,#1f6d47,#104831)!important;border:1px solid #d4bd6d!important;color:#fffdf4!important;box-shadow:0 3px 11px rgba(0,0,0,.13)!important}
  .content{padding-bottom:calc(84px + env(safe-area-inset-bottom))!important}
  .bmm-more-backdrop{padding:10px 10px calc(82px + env(safe-area-inset-bottom))}
  .bmm-more-sheet{padding:16px;border-radius:21px;max-height:min(64dvh,540px)}
  .toast{bottom:calc(86px + env(safe-area-inset-bottom))!important}
  body.bmm-more-open{overflow:hidden!important}
}
@media(max-width:390px){
  .nav button[data-mobile-primary="true"],.nav .bmm-more-trigger{min-height:56px!important;height:56px!important}
  .nav .nav-icon{font-size:18px!important}
  .nav .nav-label-text{font-size:9px!important}
  .bmm-more-sheet{padding:13px}
  .bmm-more-grid{gap:7px}
  .bmm-more-link{min-height:57px;padding:8px 8px;gap:7px;font-size:12px}
  .bmm-more-icon{flex-basis:32px;width:32px;height:32px}
}
@media(min-width:761px){.bmm-more-backdrop{display:none!important}}
@media(prefers-reduced-motion:reduce){.bmm-more-backdrop,.bmm-more-sheet{animation:none!important}.bmm-more-link{transition:none!important}}

</style></head><body>${body}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));<\/script>
<style id="bmm-analytics-dark-contrast-a4-v1">
/* Analítica y componentes heredados: superficies oscuras, texto claro y contraste consistente. */
html[data-bmm-resolved-theme="dark"] .content :is(.bar-label,.bar-value,.mini-bar-label,.mini-bar-count,.timeline-year,.timeline-date,.timeline-march,.timeline-march b,.group-stat,.group-stat strong,.group-stat span,.author-count,.author-avatar,.legend-line,.report-check,.insight-row,.insight-row strong,.insight-row span,.insight-icon,.quick-action,.quick-action strong,.quick-action span,.status-realizado,.status-planificado,.status-cancelado,.status-sin-confirmar,.no-data-pill){color:var(--bmm-text)!important}
html[data-bmm-resolved-theme="dark"] .content :is(.bar-track,.chart-empty,.timeline-item,.timeline-date,.timeline-march,.timeline-march b,.group-stat,.author-avatar,.report-check,.insight-row,.insight-icon,.quick-action,.quick-action .qa-icon,.no-data-pill,.status-realizado,.status-planificado,.status-cancelado,.status-sin-confirmar){background:var(--bmm-raised)!important;border-color:var(--bmm-border)!important;box-shadow:none!important}
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-item,.timeline-march,.timeline-date,.group-tile,.group-stat,.author-row,.author-avatar,.insight-row,.quick-action,.report-check,.bar-track,.mini-chart,.chart-empty){color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-item h3,.group-tile h3,.group-stat strong,.author-meta strong,.author-count,.rank-name,.rank-count,.bar-value,.insight-row strong,.quick-action strong){color:#f3f7f3!important}
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-meta,.group-tile p,.group-stat span,.author-meta span,.mini-bar-label,.mini-bar-count,.bar-label,.legend-line,.insight-row span,.quick-action span,.report-check){color:#c8d8cd!important}
html[data-bmm-resolved-theme="dark"] .content .timeline-date strong{color:#f4f8f4!important}html[data-bmm-resolved-theme="dark"] .content .timeline-date span{color:#c8d8cd!important}
html[data-bmm-resolved-theme="dark"] .content .timeline-march b{background:#263f2e!important;color:#f4f8f4!important}
html[data-bmm-resolved-theme="dark"] .content .bar-track{background:#263b2d!important}html[data-bmm-resolved-theme="dark"] .content .bar-fill{background:linear-gradient(90deg,#5bc58a,#a9e4bb)!important}
html[data-bmm-resolved-theme="dark"] .content .mini-bar{background:linear-gradient(180deg,#efd27b,#58bf85)!important}html[data-bmm-resolved-theme="dark"] .content .mini-chart{border-color:var(--bmm-border)!important}
html[data-bmm-resolved-theme="dark"] .content :is(.group-stat,.insight-row,.report-check,.quick-action,.timeline-item,.timeline-march,.timeline-date,.author-avatar){background:var(--bmm-surface)!important}
html[data-bmm-resolved-theme="dark"] .content .author-avatar{color:#e8f4eb!important}
html[data-bmm-resolved-theme="dark"] .content .status-realizado{background:#1d4b32!important;color:#d7f7df!important}html[data-bmm-resolved-theme="dark"] .content .status-planificado{background:#493b1b!important;color:#ffedb5!important}html[data-bmm-resolved-theme="dark"] .content .status-cancelado{background:#4c2828!important;color:#ffd0cc!important}html[data-bmm-resolved-theme="dark"] .content .status-sin-confirmar{background:#28372d!important;color:#d4e0d6!important}
html[data-bmm-resolved-theme="dark"] .content :is(.data-table th,.audit-table th){background:#1a3223!important;color:#d7e5da!important}html[data-bmm-resolved-theme="dark"] .content :is(.data-table td,.audit-table td){background:transparent!important;color:#eef5ef!important}
</style>


<style id="bmm-sidebar-history-v15">
/* A single dark brand rail is used in both themes; the content theme remains independent. */
html[data-bmm-resolved-theme="light"] .sidebar,
html[data-bmm-resolved-theme="dark"] .sidebar {
  background:linear-gradient(160deg,#0c3829 0%,#082a1e 58%,#061e15 100%)!important;
  color:#f3f8f3!important;border-right:1px solid #315343!important;
}
html[data-bmm-resolved-theme] .sidebar .brand-name,
html[data-bmm-resolved-theme] .sidebar .nav button,
html[data-bmm-resolved-theme] .sidebar .sidebar-bottom {color:#eef6ef!important;}
html[data-bmm-resolved-theme] .sidebar .brand-sub {color:#c8d9cc!important;}
html[data-bmm-resolved-theme] .sidebar .nav-label {color:#e1cb7c!important;}
html[data-bmm-resolved-theme] .sidebar .nav button:hover {background:rgba(255,255,255,.09)!important;color:#fff!important;}
html[data-bmm-resolved-theme] .sidebar .nav button.active {color:#fff!important;background:linear-gradient(105deg,#1a714a,#0c4930)!important;border-color:#d8bf69!important;}
html[data-bmm-resolved-theme] .sidebar .sidebar-admin-btn {display:flex;align-items:center;gap:9px;width:100%;margin-top:8px;padding:9px 10px;border-radius:10px;border:1px solid #62816c;background:rgba(255,255,255,.06);color:#f1f7f2!important;text-align:left;font-size:11px;font-weight:700;}
html[data-bmm-resolved-theme] .sidebar .sidebar-admin-btn:hover {background:rgba(255,255,255,.13);border-color:#d8bf69;}
html[data-bmm-resolved-theme] .sidebar .sidebar-versionline {margin-top:9px;color:#cad9ce!important;font-size:10px;}
html[data-bmm-resolved-theme] .sidebar .sidebar-status {color:#f0f6f1!important;}
.bmm-version-current{display:flex;align-items:flex-start;gap:13px;padding:15px;border:1px solid var(--bmm-border,#d5dfd5);border-radius:14px;background:linear-gradient(135deg,rgba(40,120,78,.13),rgba(201,169,80,.08));margin-bottom:16px;color:var(--bmm-text,#173629)}
.bmm-version-current h3{margin:4px 0;font-size:16px;color:inherit}.bmm-version-current p,.bmm-modal-help{margin:4px 0 0;color:var(--bmm-muted,#596e60);font-size:12px;line-height:1.55}.bmm-version-current small{font-size:9px;font-weight:800;letter-spacing:1.3px;color:var(--bmm-muted,#596e60)}
.bmm-version-mark{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:12px;background:linear-gradient(140deg,#1b7049,#0c432e);color:#fff!important;font-size:19px;font-weight:800;border:1px solid #c9ac55}
.bmm-version-timeline{display:grid;gap:0}.bmm-version-entry{display:grid;grid-template-columns:18px minmax(0,1fr);gap:10px;position:relative;padding:0 0 15px}.bmm-version-rail{position:relative;display:flex;justify-content:center}.bmm-version-rail:after{content:'';position:absolute;top:13px;bottom:-5px;width:2px;background:var(--bmm-border,#d5dfd5)}.bmm-version-entry:last-child .bmm-version-rail:after{display:none}.bmm-version-rail span{position:relative;z-index:1;display:block;width:12px;height:12px;border-radius:50%;background:#246f49;border:3px solid var(--bmm-surface,#fffefa);box-shadow:0 0 0 1px #b9c99b;margin-top:4px}.bmm-version-entry-main{min-width:0;border:1px solid var(--bmm-border,#d5dfd5);border-radius:12px;padding:12px;background:var(--bmm-surface,#fffefa);color:var(--bmm-text,#173629)}.bmm-version-entry-top{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;flex-wrap:wrap}.bmm-version-entry-top strong{font-size:13px;color:inherit}.bmm-version-entry-top time{font-size:10px;color:var(--bmm-muted,#596e60)}.bmm-version-entry-main ul{margin:9px 0 0;padding-left:18px;color:var(--bmm-muted,#596e60);font-size:12px;line-height:1.55}.bmm-version-entry-main li+li{margin-top:3px}.bmm-version-badge{display:inline-block;margin-top:7px;padding:3px 8px;border-radius:999px;background:#d9eee0;color:#185638;font-size:10px;font-weight:800}
.bmm-version-device{border-top:1px solid var(--bmm-border,#d5dfd5);margin-top:10px;padding-top:12px}.bmm-version-device h3{font-size:13px;margin:0;color:var(--bmm-text,#173629)}.bmm-version-device>p{color:var(--bmm-muted,#596e60);font-size:11px;line-height:1.5}
.bmm-version-history-card{margin-top:18px}.bmm-version-summary{display:flex;gap:11px;align-items:center;flex-wrap:wrap}.bmm-version-summary>div{flex:1;min-width:120px}.bmm-version-summary strong,.bmm-version-summary small{display:block}.bmm-version-summary strong{color:var(--bmm-text,#173629);font-size:13px}.bmm-version-summary small{color:var(--bmm-muted,#596e60);font-size:11px;margin-top:3px}.bmm-audit-modal-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:9px}.bmm-audit-modal-table{max-height:min(58vh,620px);overflow:auto;margin-top:12px;border:1px solid var(--bmm-border,#d5dfd5);border-radius:10px}
html[data-bmm-resolved-theme="dark"] .bmm-version-current{background:linear-gradient(135deg,#143a27,#182d20 58%,#302a16);border-color:#355743;color:#eef6ef}
html[data-bmm-resolved-theme="dark"] .bmm-version-current p,html[data-bmm-resolved-theme="dark"] .bmm-version-current small,html[data-bmm-resolved-theme="dark"] .bmm-modal-help{color:#c8d9ce}
html[data-bmm-resolved-theme="dark"] .bmm-version-entry-main{background:linear-gradient(145deg,#142b1d,#0b1d13);border-color:#355743;color:#eef6ef}
html[data-bmm-resolved-theme="dark"] .bmm-version-entry-main ul,html[data-bmm-resolved-theme="dark"] .bmm-version-entry-top time,html[data-bmm-resolved-theme="dark"] .bmm-version-device>p{color:#c8d9ce}
html[data-bmm-resolved-theme="dark"] .bmm-version-device h3,html[data-bmm-resolved-theme="dark"] .bmm-version-summary strong{color:#f1f7f2}
html[data-bmm-resolved-theme="dark"] .bmm-version-summary small{color:#c8d9ce}
html[data-bmm-resolved-theme="light"] .bmm-version-entry-main{background:linear-gradient(145deg,#fffefa,#f2f6ef);color:#173629}
@media(max-width:760px){.bmm-version-entry-top{display:grid}.bmm-audit-modal-table{max-height:52vh}.sidebar .sidebar-admin-btn{min-height:39px}}
/* Final print override: physical A4 dimensions regardless of locale paper defaults. */
@page{size:${orientation==='landscape'?'297mm 210mm':'210mm 297mm'};margin:12mm 11mm}
@media print{html,body{width:auto!important;min-height:0!important;margin:0!important;padding:0!important}.report-doc{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}}
</style>

</body></html>`;
  }
  function bmmPdfEscapeText(text){
    const map={'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
    let out='';for(const ch of String(text||'')){let n=map[ch];if(n===undefined){const cp=ch.codePointAt(0);n=cp<=255?cp:63;}if(n<32||n===40||n===41||n===92)out+='\\'+(n===40?'(':n===41?')':n===92?'\\':n.toString(8).padStart(3,'0'));else if(n>126)out+='\\'+n.toString(8).padStart(3,'0');else out+=String.fromCharCode(n);}return out;
  }
  function bmmReportMarkupToLines(markup){
    const doc=new DOMParser().parseFromString(markup,'text/html');const root=doc.querySelector('.report-doc')||doc.body;const out=[];
    const clean=n=>String(n?.textContent||'').replace(/\s+/g,' ').trim();
    const add=(text,kind='body')=>{text=String(text||'').trim();if(text)out.push({text,kind});};
    const walk=node=>{
      if(!node||node.nodeType!==1)return;
      const tag=node.tagName.toLowerCase();
      if(tag==='table'){
        const rows=[...node.querySelectorAll('tr')];rows.forEach((tr,i)=>{const cells=[...tr.children].map(clean).filter(Boolean);if(cells.length)add(cells.join('  |  '),i===0?'tablehead':'table');});add('');return;
      }
      if(['h1','h2','h3','h4'].includes(tag)){add(clean(node),tag);return;}
      if(tag==='p'){add(clean(node),'body');add('');return;}
      if(tag==='li'){add('• '+clean(node),'body');return;}
      if(tag==='br'){add('');return;}
      if(['script','style','button','input','label'].includes(tag))return;
      if(!node.children.length){const value=clean(node);if(value)add(value,node.classList?.contains('report-doc-kicker')?'h3':node.classList?.contains('report-event-tag')?'tablehead':'body');return;}
      for(const child of node.children)walk(child);
      if(['section','article','header','footer','div'].includes(tag))add('');
    };
    if(root)for(const child of root.children)walk(child);
    return out.length?out:[{text:'Informe de la Banda Santa Cecilia',kind:'h1'}];
  }
  function bmmBuildSimplePdf(title, contentLines){
    const source=Array.isArray(contentLines)?contentLines.map(x=>typeof x==='string'?{text:x,kind:'body'}:x):String(contentLines||'').split('\n').map(text=>({text,kind:'body'}));
    const lines=[];for(const item of source){const kind=item.kind||'body';const max=kind==='h1'?58:kind==='h2'?76:kind==='h3'?82:kind==='tablehead'?78:94;let rest=String(item.text||'').replace(/[\t ]+/g,' ').trim();if(!rest){lines.push({text:'',kind:'space'});continue;}while(rest.length>max){let cut=rest.lastIndexOf(' ',max);if(cut<Math.floor(max*.55))cut=max;lines.push({text:rest.slice(0,cut),kind});rest=rest.slice(cut).trim();}if(rest)lines.push({text:rest,kind});}
    const pages=[];let page=[],y=766;const heightFor=k=>k==='h1'?25:k==='h2'?21:k==='h3'?17:k==='space'?7:13;
    for(const line of lines){const h=heightFor(line.kind);if(y-h<48){pages.push(page);page=[];y=766;}page.push({...line,y});y-=h;}if(page.length||!pages.length)pages.push(page);
    const objects=[];const add=o=>{objects.push(o);return objects.length;};const catalogId=add('');const pagesId=add('');const fontId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const boldId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');const pageIds=[];
    pages.forEach((page,index)=>{let stream='';stream+='0.09 0.28 0.18 rg\n48 804 499 2 re f\n';stream+='BT\n/F2 15 Tf\n48 784 Td\n('+bmmPdfEscapeText(title)+') Tj\nET\n';
      for(const line of page){if(!line.text)continue;const kind=line.kind;let size=9,color='0.12 0.20 0.15';if(kind==='h1'){size=13;color='0.08 0.28 0.17';}else if(kind==='h2'){size=11;color='0.08 0.28 0.17';}else if(kind==='h3'){size=10;color='0.20 0.28 0.21';}else if(kind==='tablehead'){size=8;color='0.08 0.28 0.17';}stream+=`${color} rg\nBT\n/${['h1','h2','h3','tablehead'].includes(kind)?'F2':'F1'} ${size} Tf\n48 ${line.y} Td\n(${bmmPdfEscapeText(line.text)}) Tj\nET\n`;if(kind==='h2')stream+=`0.80 0.86 0.79 RG\n48 ${line.y-4} m 547 ${line.y-4} l S\n`;}
      stream+=`0.45 0.52 0.46 rg\nBT\n/F1 7 Tf\n48 28 Td\n(${bmmPdfEscapeText('BMM Santa Cecilia de Arjonilla · Página '+(index+1)+' de '+pages.length)}) Tj\nET\n`;
      const contentId=add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`);pageIds.push(pageId);});
    objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
    let pdf='%PDF-1.4\n% BMM Santa Cecilia\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf],{type:'application/pdf'});
  }
  async function bmmShareReportPdf(){
    const type=bmmReportType;const title=bmmReportOutputTitle(bmmReportTitle||bmmReportTitleFor(type));const events=bmmCurrentReportEvents();
    const markup=bmmReportContent(type,title,events);const lines=bmmReportMarkupToLines(markup);const blob=bmmBuildSimplePdf(title,lines);const file=new File([blob],bmmSafeName(title)+'.pdf',{type:'application/pdf'});
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){try{await navigator.share({title,text:'Informe PDF · Banda Santa Cecilia de Arjonilla',files:[file]});showToast('Informe PDF preparado para compartir');return;}catch(err){if(err&&err.name==='AbortError')return;}}
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);showToast('PDF descargado. Ábrelo desde Descargas para compartirlo por WhatsApp u otra aplicación.');
  }
  function bmmPrintReport(type, events, title){
    const t=title||bmmReportTitle||bmmReportTitleFor(type);const html=bmmReportHtmlFull(type,t,events);
    const w=window.open('','_blank');
    if(!w){
      const frame=document.createElement('iframe');frame.setAttribute('title','Vista de impresión del informe');frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:.01;pointer-events:none';document.body.appendChild(frame);
      try{
        let printed=false;
        let fallbackTimer;
        const printOnce=()=>{
          if(printed||!frame.isConnected)return;
          printed=true;clearTimeout(fallbackTimer);
          frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});
          try{frame.contentWindow.focus();frame.contentWindow.print();}catch(_){frame.remove();showToast('No se pudo abrir la impresión del navegador.',true);}
          setTimeout(()=>frame.remove(),60000);
        };
        frame.onload=printOnce;
        frame.srcdoc=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
        fallbackTimer=setTimeout(printOnce,900);
        showToast('Abriendo la impresión. En Android elige «Guardar como PDF» para crear el archivo.');
      }catch(_){frame.remove();const blob=new Blob([html],{type:'text/html;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=bmmSafeName(t)+'.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);showToast('No se pudo abrir la impresión; se descargó una versión HTML del informe.',true);}return;
    }
    w.document.open();w.document.write(html);w.document.close();
  }
  function bmmCurrentReportEvents(){if(bmmReportType==='analytics'&&bmmScopedAnalysisEventIds)return state.events.filter(e=>bmmScopedAnalysisEventIds.has(e.id));if(bmmReportType==='groups'&&bmmScopedEventIds)return state.events.filter(e=>bmmScopedEventIds.has(e.id));if(bmmReportType==='repertoire')return state.events;return bmmReportEvents();}

  // A consistent section-specific preview action from every analytics page.
  function bmmPreviewSection(type){
    bmmClearReportScope();bmmReportType=type||'events';bmmReportTitle=bmmReportTitleFor(bmmReportType);bmmReportIncludeStats=true;
    reportSearch='';reportYear='all';reportGroup='all';reportCategory='all';reportFrom='';reportTo='';
    if(type==='timeline'){const rows=bmmTimelineEvents();bmmScopedEventIds=new Set(rows.map(e=>e.id));bmmScopeDescription=`Cronología filtrada · ${rows.length} eventos`;}
    if(type==='repertoire'){const q=repSearch.trim().toLocaleLowerCase('es');const rows=state.repertoire.filter(m=>(!q||[m.name,m.author,m.style,m.season,m.publisher,...(m.tags||[])].join(' ').toLocaleLowerCase('es').includes(q))&&(repStyle==='all'||m.style===repStyle));bmmScopedMarchIds=new Set(rows.map(m=>m.id));bmmScopeDescription=`Catálogo filtrado · ${rows.length} marchas`;}
    if(type==='groups'){const q=bmmGroupSearch.trim().toLocaleLowerCase('es');const rows=state.groupsCatalog.filter(g=>!q||[g.name,g.description].join(' ').toLocaleLowerCase('es').includes(q));bmmScopedGroupIds=new Set(rows.map(g=>g.id));bmmScopedEventIds=new Set(state.events.filter(e=>rows.some(g=>g.name.toLocaleLowerCase('es')===bmmGroup(e).toLocaleLowerCase('es'))).map(e=>e.id));bmmScopeDescription=`Grupos visibles · ${rows.length} grupos`;}
    if(type==='analytics'){const rows=state.events.filter(e=>bmmAnalyticsYear==='all'||bmmYear(e)===bmmAnalyticsYear);bmmScopedAnalysisEventIds=new Set(rows.map(e=>e.id));bmmScopeDescription=`Periodo analítico · ${bmmAnalyticsYear==='all'?'todo el histórico':bmmAnalyticsYear}`;}
    reportSelectionTouched=false;selectedReportEvents.clear();setPage('informes');
  }

  // Keep original behavior for existing actions, add advanced features.
  handleAction = function(el){
    const a=el.dataset.action,id=el.dataset.id,value=el.dataset.value;
    if(a==='clear-report-scope'){bmmClearReportScope();reportSelectionTouched=false;selectedReportEvents.clear();render();return}
    if(a==='select-all-report'){reportSelectionTouched=true;getReportFilteredEvents().forEach(e=>selectedReportEvents.add(e.id));render();return}
    if(a==='clear-report-selection'){reportSelectionTouched=true;selectedReportEvents.clear();render();return}
    if(a==='preview-filtered-acts-pdf'){bmmReportType='events';bmmReportTitle=bmmReportTitleFor('events');reportSearch='';reportYear='all';reportGroup='all';reportCategory='all';reportFrom='';reportTo='';reportSelectionTouched=true;selectedReportEvents=new Set(getFilteredEvents().map(e=>e.id));setPage('informes');return}
    if(a==='march-insight'){bmmOpenMarchInsight(getMarch(id));return}
    if(a==='event-insight'){const ev=state.events.find(x=>x.id===id);if(ev)bmmOpenEventInsight(ev);return}
    if(a==='group-insight'){const g=state.groupsCatalog.find(x=>x.id===id);if(g)bmmOpenGroupInsight(g);return}
    if(a==='event-pdf'){const ev=state.events.find(x=>x.id===id);if(ev)bmmPrintObjectReport('Ficha de actuación · '+ev.name,bmmEventReportBody(ev));return}
    if(a==='march-pdf'){const m=getMarch(id);if(m)bmmPrintObjectReport('Ficha de repertorio · '+m.name,bmmMarchReportBody(m));return}
    if(a==='group-pdf'){const g=state.groupsCatalog.find(x=>x.id===id);if(g)bmmPrintObjectReport('Informe de grupo · '+g.name,bmmGroupReportBody(g));return}
    if(a==='add-group'){bmmOpenGroupForm(null);return}
    if(a==='edit-group'){const g=state.groupsCatalog.find(x=>x.id===id);if(g)bmmOpenGroupForm(g);return}
    if(a==='delete-group'){const g=state.groupsCatalog.find(x=>x.id===id);if(!g)return;const used=state.events.some(e=>bmmGroup(e).toLocaleLowerCase('es')===g.name.toLocaleLowerCase('es'));if(confirm(used?`El grupo «${g.name}» está asociado a actuaciones. Se eliminará del catálogo, pero los eventos conservarán su texto de grupo. ¿Continuar?`:`¿Eliminar el grupo «${g.name}»?`)){state.groupsCatalog=state.groupsCatalog.filter(x=>x.id!==id);save('Grupo eliminado del catálogo');}return}
    if(a==='group-events'){actSearch='';actCategory='all';actYear='all';reportGroup=value;setPage('actuaciones');document.querySelector('#actSearch')?.setAttribute('value',value);actSearch=value;render();return}
    if(a==='preview-section-pdf'){bmmPreviewSection(el.dataset.reportType||'events');return}
    if(a==='print-report-preview'){const events=bmmCurrentReportEvents();bmmPrintReport(bmmReportType,events,bmmReportOutputTitle(bmmReportTitle||bmmReportTitleFor(bmmReportType)));return}
    if(a==='share-report-pdf'){bmmShareReportPdf();return}
    if(a==='set-full-report'){bmmClearReportScope();bmmReportType='full';bmmReportTitle=bmmReportTitleFor('full');reportYear='all';reportGroup='all';reportCategory='all';reportFrom='';reportTo='';reportSearch='';reportSelectionTouched=false;selectedReportEvents.clear();render();showToast('Dossier general preparado');return}
    if(a==='export-report-html'){const type=bmmReportType;const ev=bmmCurrentReportEvents();const outputTitle=bmmReportOutputTitle(bmmReportTitle||bmmReportTitleFor(type));download(`${bmmSafeName(outputTitle)}.html`,bmmReportHtmlFull(type,outputTitle,ev).replace(/<script>[\s\S]*?<\\\/script>/,'').replace(/<script>[\s\S]*?<\/script>/g,''),'text/html;charset=utf-8');showToast('Informe HTML descargado');return}
    if(a==='export-section-csv'||a==='export-timeline-csv'){bmmExportEventSubset(a==='export-timeline-csv'?bmmTimelineEvents():getFilteredEvents(),a==='export-timeline-csv'?'cronologia':'actuaciones');return}
    if(a==='export-analytics-csv'||a==='export-march-stats-csv'){bmmExportMarchStats();return}
    if(a==='analytics-reset'){bmmAnalyticsYear='all';bmmAnalyticsMetric='plays';render();return}
    if(a==='timeline-clear'){bmmTimelineSearch='';bmmTimelineYear='all';bmmTimelineGroup='all';bmmTimelineType='all';render();return}
    return bmmBaseHandleAction(el);
  };

  function bmmExportEventSubset(events,base){
    const rows=[['Año','Fecha','Hora del evento','Grupo','Evento','Tipo','Estado','Localidad','Organiza','Marcha','Autor','Orden','Hora de interpretación','Duración (min)','Ubicación','Notas generales','Notas de interpretación']];
    [...events].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).forEach(e=>{
      const ps=(e.marches||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0));
      if(!ps.length)rows.push([bmmYear(e),e.date,e.time,bmmGroup(e),e.name,e.category,bmmStatus(e),e.locality,e.organizer,'','','','','','',e.notes,'']);
      else ps.forEach((p,i)=>{const m=getMarch(p.marchId);rows.push([bmmYear(e),e.date,e.time,bmmGroup(e),e.name,e.category,bmmStatus(e),e.locality,e.organizer,m?.name||'',m?.author||'',p.order||i+1,p.startTime||'',p.duration||'',p.location,e.notes,p.notes])});
    });
    download(`bmm-santa-cecilia-${base}-${bmmTodayKey()}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');showToast(`CSV exportado: ${events.length} eventos`);
  }
  function bmmExportMarchStats(){
    const rows=[['Marcha','Autor','Estilo','Temporada','Dificultad','Año de composición','Veces tocada','Actuaciones distintas','Primera interpretación','Última interpretación','Notas']];const c=counts();
    state.repertoire.forEach(m=>{const ps=bmmPerf().filter(p=>p.march.id===m.id);rows.push([m.name,m.author,m.style,m.season,m.difficulty,m.yearComposed,c[m.id]||0,new Set(ps.map(p=>p.event.id)).size,ps[0]?.event.date||'',ps.at(-1)?.event.date||'',m.notes])});
    download(`bmm-santa-cecilia-frecuencia-marchas-${bmmTodayKey()}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');showToast('Estadísticas de marcha exportadas');
  }

  // The app has no password configured in local mode. Forms remain editable and local.
  render = function(){
    const title=document.getElementById('topTitle');const today=document.getElementById('dateToday');const root=document.getElementById('content');if(!title||!today||!root)return;
    title.textContent=bmmPageNames[page]||'BMM Santa Cecilia de Arjonilla';today.textContent=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'}).format(new Date());
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    const build=()=>page==='dashboard'?renderDashboard():page==='actuaciones'?renderActuaciones():page==='cronologia'?renderTimeline():page==='repertorio'?renderRepertorio():page==='analitica'?renderAnalytics():page==='grupos'?renderGroups():page==='integrantes'?bmmRenderMembers():page==='informes'?renderReports():renderConfig();
    try{root.innerHTML=build();if(page==='informes')bmmUpdatePreview();}catch(err){console.error('Error al mostrar '+page,err);root.innerHTML=`<section class="card setting-card render-error"><h2>No se ha podido mostrar esta sección</h2><p>La aplicación conserva los datos guardados. Puedes volver a intentarlo o exportar una copia desde Ajustes.</p><div class="toolbar"><button class="btn btn-primary" data-action="retry-render">Volver a cargar</button><button class="btn btn-soft" data-action="export-json">Descargar copia JSON</button></div><details><summary>Detalle técnico</summary><pre style="white-space:pre-wrap">${esc(err?.message||err)}</pre></details></section>`;}
    };

  // Add support for enriched data fields while retaining old forms and storage keys.
  document.addEventListener('submit', function(e){
    const form=e.target;
    if(form.id==='eventForm'){
      e.preventDefault();e.stopImmediatePropagation();const f=new FormData(form);const id=String(f.get('eventId')||'');const name=String(f.get('name')||'').trim();if(!name){showToast('Indica el nombre del evento.',true);return;}
      const old=state.events.find(x=>x.id===id);const marches=[...form.querySelectorAll('.march-row')].map((row,i)=>{const g=n=>row.querySelector(`[name="${n}"]`)?.value?.trim()||'';return {id:uid('perf'),marchId:g('marchId'),sourceTitle:g('sourceTitle'),sourceStop:parseInt(g('sourceStop'),10)||parseInt(g('order'),10)||i+1,location:g('location'),order:parseInt(g('order'),10)||i+1,startTime:g('startTime'),duration:g('duration'),notes:g('notes')}}).filter(p=>p.marchId);
      [...form.querySelectorAll('input[name="quickMarchIds"]:checked')].forEach(cb=>{const qtyNode=[...form.querySelectorAll('[data-quick-count]')].find(n=>n.dataset.marchId===cb.value);const qty=Math.max(1,Math.min(10,parseInt(qtyNode?.value,10)||1));for(let n=0;n<qty;n++)marches.push({id:uid('perf'),marchId:cb.value,location:'',order:marches.length+1,notes:''});});marches.forEach((p,i)=>{if(!p.order||p.order<1)p.order=i+1});
      const group=String(f.get('group')||'').trim();if(group&&!state.groupsCatalog.some(g=>g.name.toLocaleLowerCase('es')===group.toLocaleLowerCase('es')))state.groupsCatalog.push({id:uid('group'),name:group,description:'Creado desde una ficha de actuación',color:bmmColors[state.groupsCatalog.length%bmmColors.length]});
      const eventDate=String(f.get('date')||'');
      const requestedStatus=String(f.get('status')||'Planificado');
      const effectiveStatus=bmmEffectiveEventStatus(eventDate,requestedStatus);
      const obj={...(old||{}),id:id||uid('event'),date:eventDate,time:String(f.get('time')||''),group,name,category:String(f.get('category')||'Otro'),status:effectiveStatus,locality:String(f.get('locality')||'').trim(),organizer:String(f.get('organizer')||'').trim(),duration:String(f.get('duration')||'').trim(),startPlace:String(f.get('startPlace')||'').trim(),endPlace:String(f.get('endPlace')||'').trim(),route:String(f.get('route')||'').trim(),notes:String(f.get('eventNotes')||'').trim(),tags:bmmUniq(String(f.get('eventTags')||'').split(',').map(x=>x.trim())),reserves:bmmUniq(String(f.get('reserves')||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean)),dateNeedsConfirmation:f.get('dateConfirmed')!=='yes',marches};
      if(id)state.events=state.events.map(x=>x.id===id?obj:x);else state.events.push(obj);try{if(!id&&!form.dataset.bmmDuplicate)localStorage.removeItem(BMM_DRAFT_KEY)}catch(_){}closeModal();save(id?'Actuación actualizada: '+name:'Actuación registrada: '+name);setPage('actuaciones');return;
    }
    if(form.id==='marchForm'){
      e.preventDefault();e.stopImmediatePropagation();const f=new FormData(form);const id=String(f.get('marchId')||'');const name=String(f.get('name')||'').trim();if(!name)return;
      if(state.repertoire.some(m=>m.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')&&m.id!==id)){showToast('Ya existe una marcha con ese nombre.',true);return;}
      const old=getMarch(id)||{};const obj={...old,id:id||uid('march'),name,author:String(f.get('author')||'').trim(),style:String(f.get('style')||'').trim(),season:String(f.get('season')||'').trim(),difficulty:String(f.get('difficulty')||'').trim(),yearComposed:String(f.get('yearComposed')||'').trim(),publisher:String(f.get('publisher')||'').trim(),notes:String(f.get('marchNotes')||'').trim(),tags:bmmUniq(String(f.get('marchTags')||'').split(',').map(x=>x.trim()))};
      if(id)state.repertoire=state.repertoire.map(m=>m.id===id?obj:m);else state.repertoire.push(obj);closeModal();save(id?'Ficha de marcha actualizada: '+name:'Marcha añadida al repertorio: '+name);setPage('repertorio');return;
    }
    if(form.id==='bmmGroupForm'){
      e.preventDefault();e.stopImmediatePropagation();const f=new FormData(form);const id=String(f.get('groupId')||'');const name=String(f.get('groupName')||'').trim();if(!name){showToast('Escribe un nombre para el grupo.',true);return;}
      if(state.groupsCatalog.some(g=>g.name.toLocaleLowerCase('es')===name.toLocaleLowerCase('es')&&g.id!==id)){showToast('Ya existe un grupo con ese nombre.',true);return;}
      const old=state.groupsCatalog.find(g=>g.id===id)||{};const obj={...old,id:id||uid('group'),name,description:String(f.get('groupDescription')||'').trim(),color:String(f.get('groupColor')||old.color||bmmColors[0])};
      if(id){state.groupsCatalog=state.groupsCatalog.map(g=>g.id===id?obj:g);state.events.forEach(ev=>{if(old.name&&ev.group===old.name)ev.group=name;});}else state.groupsCatalog.push(obj);
      closeModal();save(id?'Grupo actualizado: '+name:'Grupo creado: '+name);setPage('grupos');return;
    }
  }, true);

  // Registro de integrantes de la banda.
  let bmmMemberSearch='', bmmMemberInstrument='all', bmmMemberYear='all', bmmMemberStatus='all';
  const bmmInstrumentSuggestions=['Flauta','Oboe','Fagot','Requinto','Clarinete','Clarinete bajo','Saxofón soprano','Saxofón alto','Saxofón tenor','Saxofón barítono','Trompeta','Fliscorno','Trompa','Trombón','Bombardino','Tuba','Percusión','Piano','Otro'];
  function bmmCurrentMembers(){
    const rows=Array.isArray(state.members)?state.members:[], q=bmmMemberSearch.trim().toLocaleLowerCase('es'), globalQ=(typeof bmmGlobal!=='undefined'?bmmGlobal.q:'').trim().toLocaleLowerCase('es');
    return rows.filter(m=>{
      const blob=[m.name,m.instrument,m.registrationYear,m.section,m.role,m.status,m.email,m.phone,m.notes,...(m.tags||[])].join(' ').toLocaleLowerCase('es');
      const localOk=!q||blob.includes(q), globalOk=!globalQ||blob.includes(globalQ);
      const yearOk=(bmmMemberYear==='all'||m.registrationYear===bmmMemberYear)&&(!(typeof bmmGlobal!=='undefined')||bmmGlobal.year==='all'||m.registrationYear===bmmGlobal.year);
      const instrOk=bmmMemberInstrument==='all'||m.instrument===bmmMemberInstrument;
      const statusOk=bmmMemberStatus==='all'||(m.status||'Activo')===bmmMemberStatus;
      return localOk&&globalOk&&yearOk&&instrOk&&statusOk;
    }).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  }
  function bmmMemberReportBody(members,title='Integrantes de la banda'){
    const logo=document.querySelector('.brand-mark img')?.src||'assets/escudo-santa-cecilia.jpg';
    const countByInstrument=Object.entries(bmmCountBy(members,m=>m.instrument||'Sin instrumento')).sort((a,b)=>b[1]-a[1]);
    return `<div class="report-doc"><div class="report-doc-header"><img class="report-doc-logo" src="${logo}" alt="Escudo"><div><div class="report-doc-kicker">BMM Santa Cecilia de Arjonilla · Registro de integrantes</div><h1>${esc(title)}</h1><div class="report-doc-subtitle">Documento generado el ${esc(new Date().toLocaleDateString('es-ES'))}</div></div></div><div class="report-doc-kpis"><div class="report-doc-kpi"><strong>${members.length}</strong><span>Integrantes incluidos</span></div><div class="report-doc-kpi"><strong>${members.filter(m=>(m.status||'Activo')==='Activo').length}</strong><span>Activos</span></div><div class="report-doc-kpi"><strong>${new Set(members.map(m=>m.instrument).filter(Boolean)).size}</strong><span>Instrumentos</span></div><div class="report-doc-kpi"><strong>${members.filter(m=>m.registrationYear===bmmCurrentYear()).length}</strong><span>Altas este año</span></div></div><h2>Listado de integrantes</h2><table><thead><tr><th>Nombre</th><th>Instrumento</th><th>Año de inscripción</th><th>Sección / cuerda</th><th>Función</th><th>Estado</th>${members.some(m=>m.notes)?'<th>Observaciones</th>':''}</tr></thead><tbody>${members.map(m=>`<tr><td><strong>${esc(m.name)}</strong></td><td>${esc(m.instrument||'—')}</td><td>${esc(m.registrationYear||'—')}</td><td>${esc(m.section||'—')}</td><td>${esc(m.role||'—')}</td><td>${esc(m.status||'Activo')}</td>${members.some(x=>x.notes)?`<td>${esc(m.notes||'—')}</td>`:''}</tr>`).join('')}</tbody></table><h2>Distribución por instrumento</h2><table><thead><tr><th>Instrumento</th><th>Integrantes</th><th>Porcentaje</th></tr></thead><tbody>${countByInstrument.map(([instrument,n])=>`<tr><td>${esc(instrument)}</td><td>${n}</td><td>${members.length?Math.round(n/members.length*100):0}%</td></tr>`).join('')}</tbody></table><div class="report-doc-footer"><span>BMM Santa Cecilia de Arjonilla</span><span>Información del registro local</span></div></div>`;
  }
  function bmmRenderMembers(){
    const all=Array.isArray(state.members)?state.members:[], rows=bmmCurrentMembers(), allInst=[...new Set(all.map(m=>m.instrument).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),
      years=[...new Set(all.map(m=>m.registrationYear).filter(Boolean))].sort((a,b)=>b.localeCompare(a)), active=all.filter(m=>(m.status||'Activo')==='Activo').length,
      now=all.filter(m=>m.registrationYear===bmmCurrentYear()).length, instCounts=Object.entries(bmmCountBy(rows,m=>m.instrument||'Sin instrumento')).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count), yearsCounts=Object.entries(bmmCountBy(rows,m=>m.registrationYear||'Sin año')).map(([label,count])=>({label,count})).sort((a,b)=>a.label.localeCompare(b.label)).slice(-10);
    const clearActive=!!(bmmMemberSearch||bmmMemberInstrument!=='all'||bmmMemberYear!=='all'||bmmMemberStatus!=='all');
    return `${bmmHeader('Personas y plantilla','Integrantes de la banda','Un registro sencillo y centralizado de los músicos: instrumento, año de incorporación, sección, función y estado. Añade, corrige o exporta la plantilla desde el móvil o la tablet.',`<button class="btn btn-soft" data-action="members-pdf">▧ PDF de integrantes</button><button class="btn btn-soft" data-action="members-csv">⇩ Exportar CSV</button><button class="btn btn-primary" data-action="add-member">＋ Nuevo integrante</button>`)}
      <div class="pro-grid" style="margin-bottom:17px">${bmmProKpi('♟','Integrantes registrados',all.length,'Personas incluidas en la plantilla')}${bmmProKpi('✓','En activo',active,'Integrantes marcados como activos','#e2f0df')}${bmmProKpi('♫','Instrumentos representados',new Set(all.map(m=>m.instrument).filter(Boolean)).size,'Variedad instrumental','#e8eee0')}${bmmProKpi('＋','Altas este año',now,`Año ${bmmCurrentYear()}`,'#f3ebcf')}</div>
      <section class="filter-panel" aria-label="Filtros de integrantes"><div class="field" style="grid-column:span 2"><label for="memberSearch">Buscar integrante</label><input id="memberSearch" type="search" value="${esc(bmmMemberSearch)}" placeholder="Nombre, instrumento, sección, notas…"></div><div class="field"><label for="memberInstrument">Instrumento</label><select id="memberInstrument"><option value="all">Todos los instrumentos</option>${allInst.map(x=>`<option value="${esc(x)}" ${bmmMemberInstrument===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label for="memberYear">Año de inscripción</label><select id="memberYear"><option value="all">Todos los años</option>${years.map(x=>`<option value="${esc(x)}" ${bmmMemberYear===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label for="memberStatus">Estado</label><select id="memberStatus"><option value="all">Todos</option>${['Activo','Baja temporal','Baja definitiva'].map(x=>`<option value="${esc(x)}" ${bmmMemberStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field" style="align-self:end"><button class="btn btn-soft" data-action="members-reset-filters">↺ Restablecer filtros</button></div></section>
      <div class="section-toolbar"><span class="pill">${rows.length} de ${all.length} integrantes</span><span class="pill gold">${instCounts.length} instrumentos en selección</span><span class="spacer"></span>${clearActive?'<button class="btn btn-soft btn-small" data-action="members-reset-filters">Limpiar búsqueda y filtros</button>':''}</div>
      <div class="member-grid">${rows.map(m=>{const yearsIn=m.registrationYear?Math.max(0,Number(bmmCurrentYear())-Number(m.registrationYear)):null;return `<article class="member-card"><div class="member-card-head"><div class="member-avatar">${esc(bmmInitials(m.name))}</div><div class="member-heading"><h3>${esc(m.name)}</h3><p>${esc(m.instrument||'Instrumento pendiente')}</p></div><span class="member-status ${(m.status||'Activo')==='Activo'?'':'inactive'}">${esc(m.status||'Activo')}</span></div><div style="margin-top:10px"><span class="member-instrument-chip">♫ ${esc(m.instrument||'Sin instrumento')}</span></div><div class="member-facts"><div class="member-fact"><strong>${esc(m.registrationYear||'—')}</strong><span>Año de alta</span></div><div class="member-fact"><strong>${yearsIn===null?'—':yearsIn}</strong><span>Años en la banda</span></div><div class="member-fact"><strong>${esc(m.section||'—')}</strong><span>Sección / cuerda</span></div></div><div class="member-meta">${m.role?`<span>Función: ${esc(m.role)}</span>`:''}${m.email?`<span>✉ ${esc(m.email)}</span>`:''}${m.phone?`<span>☎ ${esc(m.phone)}</span>`:''}</div>${m.notes?`<p style="font-size:11px;color:#738176;margin:10px 0 0;white-space:pre-wrap">${esc(m.notes)}</p>`:''}<div class="member-actions"><button class="btn btn-soft btn-small" data-action="member-insight" data-id="${esc(m.id)}">Ver ficha</button><button class="btn btn-soft btn-small" data-action="edit-member" data-id="${esc(m.id)}">✎ Editar</button><button class="icon-btn" data-action="member-pdf" data-id="${esc(m.id)}" title="Imprimir ficha PDF">▧</button><button class="icon-btn" data-action="delete-member" data-id="${esc(m.id)}" title="Eliminar integrante">⌫</button></div></article>`}).join('')||`<div class="member-empty"><strong>${all.length?'No hay integrantes que coincidan':'Todavía no hay integrantes registrados'}</strong><span>${all.length?'Prueba a cambiar o restablecer los filtros.':'Añade el primer músico y construye la plantilla de la banda.'}</span><div style="margin-top:13px"><button class="btn btn-primary" data-action="add-member">＋ Añadir primer integrante</button></div></div>`}</div>
      <div class="pro-grid"><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Integrantes por instrumento</h2><p>Distribución de la plantilla según los filtros activos</p></div></div><div class="pro-card-body">${bmmBarChart(instCounts)}</div></section><section class="pro-card span-6"><div class="pro-card-head"><div><h2>Altas por año</h2><p>Año de inscripción del conjunto seleccionado</p></div></div><div class="pro-card-body">${bmmBarChart(yearsCounts)}</div></section></div>`;
  }
  function bmmOpenMemberForm(m){
    const editing=!!m, instruments=bmmInstrumentSuggestions.map(x=>`<option value="${esc(x)}">`).join('');
    const body=`<form id="bmmMemberForm"><input type="hidden" name="memberId" value="${esc(m?.id||'')}"><div class="form-grid"><div class="field full"><label>Nombre y apellidos *</label><input name="memberName" maxlength="140" required autocomplete="name" value="${esc(m?.name||'')}" placeholder="Nombre completo"></div><div class="field"><label>Instrumento principal *</label><input name="memberInstrument" list="bmmInstrumentOptions" required maxlength="90" value="${esc(m?.instrument||'')}" placeholder="Ej. Clarinete"><datalist id="bmmInstrumentOptions">${instruments}</datalist></div><div class="field"><label>Año de inscripción *</label><input name="memberRegistrationYear" type="number" min="1900" max="${Number(bmmCurrentYear())+1}" required value="${esc(m?.registrationYear||bmmCurrentYear())}" placeholder="Ej. 2018"></div><div class="field"><label>Sección / cuerda</label><input name="memberSection" maxlength="80" value="${esc(m?.section||'')}" placeholder="Ej. Clarinete primero"></div><div class="field"><label>Función en la banda</label><input name="memberRole" maxlength="90" value="${esc(m?.role||'')}" placeholder="Ej. Director, jefe de cuerda…"></div><div class="field"><label>Estado</label><select name="memberStatus">${['Activo','Baja temporal','Baja definitiva'].map(x=>`<option value="${esc(x)}" ${(m?.status||'Activo')===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Correo (opcional)</label><input name="memberEmail" type="email" maxlength="160" autocomplete="email" value="${esc(m?.email||'')}" placeholder="correo@ejemplo.es"></div><div class="field"><label>Teléfono (opcional)</label><input name="memberPhone" type="tel" maxlength="40" autocomplete="tel" value="${esc(m?.phone||'')}" placeholder="Teléfono de contacto"></div><div class="field full"><label>Observaciones</label><textarea name="memberNotes" rows="3" maxlength="1500" placeholder="Información útil para la organización de la banda…">${esc(m?.notes||'')}</textarea></div></div><div class="member-form-note">El nombre, el instrumento y el año de inscripción son los datos mínimos. Los datos de contacto son opcionales.</div></form>`;
    openModal(editing?'Editar integrante':'Nuevo integrante','Completa la ficha del músico. Podrás corregirla o cambiar su estado en cualquier momento.',body,`<button class="btn btn-soft" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="bmmMemberForm">${editing?'Guardar cambios':'Añadir integrante'}</button>`);
  }
  function bmmDownloadMembersCSV(rows=bmmCurrentMembers()){
    const data=[['Nombre','Instrumento','Año de inscripción','Sección / cuerda','Función','Estado','Correo','Teléfono','Observaciones'],...rows.map(m=>[m.name,m.instrument,m.registrationYear,m.section,m.role,m.status,m.email,m.phone,m.notes])];
    download(`bmm-santa-cecilia-integrantes-${bmmTodayKey()}.csv`,'\ufeff'+data.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');showToast(`CSV preparado: ${rows.length} integrantes`);
  }
  function bmmOpenMemberInsight(m){
    if(!m)return;const duration=m.registrationYear?Math.max(0,Number(bmmCurrentYear())-Number(m.registrationYear)):null;
    const body=`<div class="report-doc"><div class="report-doc-header"><img class="report-doc-logo" src="assets/escudo-santa-cecilia.jpg" alt="Escudo"><div><div class="report-doc-kicker">BMM Santa Cecilia de Arjonilla · ficha de integrante</div><h1>${esc(m.name)}</h1><div class="report-doc-subtitle">${esc(m.instrument||'Instrumento pendiente')} · ${esc(m.status||'Activo')}</div></div></div><div class="report-doc-kpis"><div class="report-doc-kpi"><strong>${esc(m.registrationYear||'—')}</strong><span>Año de inscripción</span></div><div class="report-doc-kpi"><strong>${duration===null?'—':duration}</strong><span>Años en la banda</span></div><div class="report-doc-kpi"><strong>${esc(m.section||'—')}</strong><span>Sección / cuerda</span></div><div class="report-doc-kpi"><strong>${esc(m.role||'—')}</strong><span>Función</span></div></div><h2>Datos de la ficha</h2><table><tbody><tr><th>Nombre</th><td>${esc(m.name)}</td></tr><tr><th>Instrumento</th><td>${esc(m.instrument||'—')}</td></tr><tr><th>Inscripción</th><td>${esc(m.registrationYear||'—')}</td></tr><tr><th>Correo</th><td>${esc(m.email||'—')}</td></tr><tr><th>Teléfono</th><td>${esc(m.phone||'—')}</td></tr><tr><th>Observaciones</th><td>${esc(m.notes||'—')}</td></tr></tbody></table></div>`;
    openModal('Ficha de integrante',`${m.name} · ficha de información`,body,`<button class="btn btn-soft" data-action="close-modal">Cerrar</button><button class="btn btn-soft" data-action="member-pdf" data-id="${esc(m.id)}">▧ Imprimir / PDF</button><button class="btn btn-primary" data-action="edit-member" data-id="${esc(m.id)}">✎ Editar integrante</button>`);
  }

  // Filters and report configuration.
  document.addEventListener('change',function(e){const t=e.target;
    if(t.matches('[data-report-event]')){reportSelectionTouched=true;setTimeout(()=>{if(page==='informes')render()},0);return;}
    switch(t.id){
      case 'timelineYear':bmmTimelineYear=t.value;render();break;case 'timelineGroup':bmmTimelineGroup=t.value;render();break;case 'timelineType':bmmTimelineType=t.value;render();break;
      case 'analyticsYear':bmmAnalyticsYear=t.value;render();break;case 'analyticsMetric':bmmAnalyticsMetric=t.value;render();break;
      case 'reportType':bmmClearReportScope();bmmReportType=t.value;bmmReportTitle=bmmReportTitleFor(t.value);reportSelectionTouched=false;selectedReportEvents.clear();render();break;
      case 'reportOrientation':bmmReportOrientation=t.value;render();break;
      case 'reportIncludeDateInTitle':bmmReportIncludeDateInTitle=t.checked;render();break;
      case 'reportIncludeStats':bmmReportIncludeStats=t.checked;render();break;case 'reportIncludeAuthors':bmmReportIncludeAuthors=t.checked;render();break;case 'reportIncludeNotes':bmmReportIncludeNotes=t.checked;render();break;
    }
  });
  document.addEventListener('input',function(e){const t=e.target;
    if(t.id==='timelineSearch'){bmmTimelineSearch=t.value;const pos=t.selectionStart;render();const n=document.getElementById('timelineSearch');n?.focus();n?.setSelectionRange(pos,pos);}
    if(t.id==='groupSearch'){bmmGroupSearch=t.value;const pos=t.selectionStart;render();const n=document.getElementById('groupSearch');n?.focus();n?.setSelectionRange(pos,pos);}
    if(t.id==='reportTitle'){bmmReportTitle=t.value;const slot=document.getElementById('reportPreviewDocument');if(slot){const pos=t.selectionStart; bmmUpdatePreview();const n=document.getElementById('reportTitle');n?.focus();n?.setSelectionRange(pos,pos);}}
  });

  // Ensure output supports direct section exports, print and report preview across each area.
  const oldReportPDF = printReport;
  printReport = function(){bmmPrintReport(bmmReportType,bmmCurrentReportEvents(),bmmReportOutputTitle(bmmReportTitle||bmmReportTitleFor(bmmReportType)));};
  // La navegación se gestiona una sola vez mediante el listener global [data-page].
  bmmAddActionButtons();
  render();


  // Global filters, contextual actions, explicit save, audit trail and hosted cloud sync.
  const BMM_AUDIT_KEY='bmm-santa-cecilia-audit-v1';
  const bmmGlobal={q:'',year:'all',group:'all',category:'all',from:'',to:''};
  let bmmFullDatasetForQuality=null;
  let bmmCloudMode=false,bmmAuthenticated=false,bmmSyncTimer=null,bmmSyncBusy=false,bmmLastSave='';
  const bmmLocalHost=()=>['file:','content:'].includes(location.protocol)||['localhost','127.0.0.1'].includes(location.hostname)||!location.hostname;
  const bmmGetAudit=()=>Array.isArray(state.auditLog)?state.auditLog:[];
  const bmmAddAudit=(label,kind='Cambio')=>{const log=bmmGetAudit();log.unshift({id:uid('log'),at:new Date().toISOString(),page:page,kind,label:String(label||'Cambio guardado').slice(0,220)});state.auditLog=log.slice(0,1500);};
  const bmmBaseSaveFinal=save;
  save=function(msg='Cambios guardados'){bmmAddAudit(msg);bmmLastSave=new Date().toISOString();const r=bmmBaseSaveFinal(msg);bmmRefreshStatus();if(r!==false)bmmScheduleCloudSave();return r;};
  function bmmFilteredEvents(source=state){const q=bmmGlobal.q.trim().toLocaleLowerCase('es');return source.events.filter(e=>{const d=e.date||'',group=bmmGroup(e);const blob=[e.name,e.group,e.category,e.locality,e.organizer,e.notes,e.route,...(e.tags||[]),...(e.marches||[]).map(p=>{const m=getMarch(p.marchId);return [m?.name,m?.author,m?.style].filter(Boolean).join(' ')})].join(' ').toLocaleLowerCase('es');return (!q||blob.includes(q))&&(bmmGlobal.year==='all'||bmmYear(e)===bmmGlobal.year)&&(bmmGlobal.group==='all'||group===bmmGlobal.group)&&(bmmGlobal.category==='all'||e.category===bmmGlobal.category)&&(!bmmGlobal.from||d>=bmmGlobal.from)&&(!bmmGlobal.to||d<=bmmGlobal.to)});}
  function bmmScopedState(){const ev=bmmFilteredEvents();const q=bmmGlobal.q.trim().toLocaleLowerCase('es');const ids=new Set(ev.flatMap(e=>(e.marches||[]).map(p=>p.marchId)));const narrowEvents=bmmGlobal.year!=='all'||bmmGlobal.group!=='all'||bmmGlobal.category!=='all'||bmmGlobal.from||bmmGlobal.to;const rep=state.repertoire.filter(m=>{const searchOk=!q||[m.name,m.author,m.style,m.season,m.publisher,m.notes,...(m.tags||[])].join(' ').toLocaleLowerCase('es').includes(q);return searchOk&&(!narrowEvents||ids.has(m.id))});const groups=state.groupsCatalog.filter(g=>{const searchOk=!q||[g.name,g.description].join(' ').toLocaleLowerCase('es').includes(q);const groupOk=bmmGlobal.group==='all'||g.name===bmmGlobal.group;return searchOk&&groupOk&&(!narrowEvents||ev.some(e=>bmmGroup(e)===g.name))});return {events:ev,repertoire:rep,groupsCatalog:groups};}
  function bmmGlobalFilterHTML(source=state){const filtered=source.events.filter(e=>{const q=bmmGlobal.q.trim().toLocaleLowerCase('es');const d=e.date||'';const blob=[e.name,e.group,e.category,e.locality,e.organizer,e.notes,e.route,...(e.tags||[]),...(e.marches||[]).map(p=>getMarch(p.marchId)?.name||'')].join(' ').toLocaleLowerCase('es');return (!q||blob.includes(q))&&(bmmGlobal.year==='all'||bmmYear(e)===bmmGlobal.year)&&(bmmGlobal.group==='all'||bmmGroup(e)===bmmGlobal.group)&&(bmmGlobal.category==='all'||e.category===bmmGlobal.category)&&(!bmmGlobal.from||d>=bmmGlobal.from)&&(!bmmGlobal.to||d<=bmmGlobal.to)});const years=[...new Set(source.events.map(bmmYear).filter(y=>y!=='Sin año'))].sort().reverse();const groups=[...new Set([...source.groupsCatalog.map(g=>g.name),...source.events.map(bmmGroup)])].sort((a,b)=>a.localeCompare(b,'es'));const categories=bmmUniq([...source.categories,...source.events.map(e=>e.category)]).sort((a,b)=>a.localeCompare(b,'es'));const active=Object.values(bmmGlobal).some(v=>v&&v!=='all');return `<section class="global-filterbar" aria-label="Filtros generales"><div class="global-filter-title"><span>Filtros de esta vista</span><span>Los indicadores, gráficos, listas y documentos se ajustan a la selección</span></div><div class="field global-search"><label for="bmmGlobalQ">Buscar en el registro</label><input type="search" id="bmmGlobalQ" class="global-search-input" autocomplete="off" spellcheck="false" aria-label="Buscar actuaciones, marchas, autores o lugares" value="${esc(bmmGlobal.q)}" placeholder="Actuación, marcha, autor o lugar…"></div><div class="field"><label for="bmmGlobalYear">Año</label><select id="bmmGlobalYear"><option value="all">Todos los años</option>${years.map(y=>`<option value="${esc(y)}" ${bmmGlobal.year===y?'selected':''}>${esc(y)}</option>`).join('')}</select></div><div class="field"><label for="bmmGlobalGroup">Grupo</label><select id="bmmGlobalGroup"><option value="all">Todos los grupos</option>${groups.map(g=>`<option value="${esc(g)}" ${bmmGlobal.group===g?'selected':''}>${esc(g)}</option>`).join('')}</select></div><div class="field"><label for="bmmGlobalCategory">Tipo de evento</label><select id="bmmGlobalCategory"><option value="all">Todos los tipos</option>${categories.map(c=>`<option value="${esc(c)}" ${bmmGlobal.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div class="field"><label for="bmmGlobalFrom">Desde</label><input id="bmmGlobalFrom" type="date" value="${esc(bmmGlobal.from)}"></div><div class="field"><label for="bmmGlobalTo">Hasta</label><input id="bmmGlobalTo" type="date" value="${esc(bmmGlobal.to)}"></div><button class="btn btn-soft" data-action="reset-global-filters">↺ Restablecer${active?' filtros':''}</button></section><p class="section-filter-note">${filtered.length} de ${source.events.length} actuaciones · ${totalPlays(filtered)} interpretaciones dentro del filtro general.</p>`;}
  function bmmContextAction(){return null;}
  function bmmRefreshTopbar(){
    const host=document.querySelector('.top-right');if(!host)return;
    host.innerHTML=`<span class="date-today" id="dateToday"></span><span class="cloud-state" id="bmmCloudState">${bmmCloudMode?(bmmAuthenticated?'Nube conectada':'Acceso pendiente'):'Modo local'}</span>`;
    const date=document.getElementById('dateToday');if(date)date.textContent=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'}).format(new Date());
  }
  function bmmEnsureFloatingSave(){
    if(document.getElementById('bmmFloatingSaveBtn'))return;
    const btn=document.createElement('button');btn.type='button';btn.id='bmmFloatingSaveBtn';btn.className='bmm-floating-save';btn.dataset.action='save-now';btn.setAttribute('aria-label','Guardar todos los cambios');
    btn.innerHTML='<span class="bmm-save-icon" aria-hidden="true">✓</span><span class="bmm-save-label">Guardar</span>';
    document.body.appendChild(btn);
  }
  function bmmFlashSaveState(label,delay=1900){
    const btn=document.getElementById('bmmFloatingSaveBtn');if(!btn)return;const text=btn.querySelector('.bmm-save-label');if(text)text.textContent=label;
    btn.classList.toggle('is-saved',label==='Guardado');
    clearTimeout(window.bmmSaveStateTimer);window.bmmSaveStateTimer=setTimeout(()=>{const current=document.querySelector('#bmmFloatingSaveBtn .bmm-save-label');if(current)current.textContent='Guardar';btn.classList.remove('is-saved');window.bmmSaveStateTimer=null;},delay);
  }
  function bmmRefreshStatus(){const b=document.querySelector('.sidebar-bottom');if(b)b.innerHTML=`<div><span class="status-dot"></span>${bmmCloudMode?(bmmAuthenticated?'Sincronización en la nube':'Pendiente de iniciar sesión'):'Guardado en este dispositivo'}</div><div style="margin-top:9px">BMM Santa Cecilia · ${bmmCloudMode?'Nube':'Modo local'}</div><div style="margin-top:9px"><button class="btn btn-soft btn-small" data-page="configuracion">Ver registro de cambios</button></div>`;}
  const bmmOriginalRenderFinal=render;
  render=function(){
    const fullState=state;const filterMarkup=bmmGlobalFilterHTML(fullState);const scoped=bmmScopedState();bmmFullDatasetForQuality=fullState;state={...fullState,events:scoped.events,repertoire:scoped.repertoire,groupsCatalog:scoped.groupsCatalog};
    try{bmmOriginalRenderFinal();const root=document.getElementById('content');if(root){root.insertAdjacentHTML('afterbegin',filterMarkup);}bmmRefreshTopbar();bmmRefreshStatus();window.bmmSyncCompactNav?.();}
    finally{state=fullState;bmmFullDatasetForQuality=null;}
  };
  // Inputs are stateful; rerender only after changing the filter state.
  document.addEventListener('change',function(e){const t=e.target;if(t.id==='memberInstrument'){bmmMemberInstrument=t.value;render();return;}if(t.id==='memberYear'){bmmMemberYear=t.value;render();return;}if(t.id==='memberStatus'){bmmMemberStatus=t.value;render();return;}});
  document.addEventListener('input',function(e){const t=e.target;if(t.id==='memberSearch'){bmmMemberSearch=t.value;const pos=t.selectionStart;render();const n=document.getElementById('memberSearch');n?.focus();try{n?.setSelectionRange(pos,pos)}catch(_){} }});
  document.addEventListener('change',function(e){const t=e.target;if(!t.id?.startsWith('bmmGlobal'))return;const map={bmmGlobalYear:'year',bmmGlobalGroup:'group',bmmGlobalCategory:'category',bmmGlobalFrom:'from',bmmGlobalTo:'to'};const k=map[t.id];if(k)bmmGlobal[k]=t.value;render();});
  document.addEventListener('input',function(e){const t=e.target;if(t.id==='bmmGlobalQ'){bmmGlobal.q=t.value;const pos=t.selectionStart;render();const n=document.getElementById('bmmGlobalQ');n?.focus();try{n?.setSelectionRange(pos,pos)}catch(_){}}});

  // Save changes to members through the same local/cloud state and audit pipeline.
  document.addEventListener('submit',function(e){
    const form=e.target;if(form.id!=='bmmMemberForm')return;e.preventDefault();e.stopImmediatePropagation();
    const f=new FormData(form),id=String(f.get('memberId')||''),name=String(f.get('memberName')||'').trim(),instrument=String(f.get('memberInstrument')||'').trim(),registrationYear=String(f.get('memberRegistrationYear')||'').trim();
    if(!name||!instrument||!/^\d{4}$/.test(registrationYear)||Number(registrationYear)<1900||Number(registrationYear)>Number(bmmCurrentYear())+1){showToast('Revisa nombre, instrumento y año de inscripción.',true);return;}
    const old=(state.members||[]).find(m=>m.id===id);const member={...(old||{}),id:id||uid('member'),name,instrument,registrationYear,section:String(f.get('memberSection')||'').trim(),role:String(f.get('memberRole')||'').trim(),status:String(f.get('memberStatus')||'Activo'),email:String(f.get('memberEmail')||'').trim(),phone:String(f.get('memberPhone')||'').trim(),notes:String(f.get('memberNotes')||'').trim()};
    state.members=Array.isArray(state.members)?state.members:[];if(id)state.members=state.members.map(x=>x.id===id?member:x);else state.members.push(member);
    closeModal();page='integrantes';save(id?'Ficha de integrante actualizada: '+name:'Integrante añadido: '+name);setPage('integrantes');
  },true);

  // Persistent change history in the app and in the cloud snapshot.
  function bmmAuditHTML(){const rows=bmmGetAudit().slice(0,250);return `<div class="pro-card" style="margin-top:18px"><div class="pro-card-head"><div><h2>Registro de cambios</h2><p>Historial local y, cuando está publicada, sincronizado con la copia en la nube.</p></div><span class="audit-badge">${rows.length} registros</span></div><div class="pro-card-body"><div class="toolbar" style="margin-bottom:12px"><button class="btn btn-soft btn-small" data-action="export-audit">Exportar registro CSV</button><button class="btn btn-soft btn-small" data-action="clear-audit">Vaciar historial</button></div>${rows.length?`<div class="table-wrap"><table class="audit-table"><thead><tr><th>Fecha y hora</th><th>Sección</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(new Date(x.at).toLocaleString('es-ES'))}</td><td>${esc(bmmPageNames[x.page]||x.page||'—')}</td><td>${esc(x.kind||'Cambio')}</td><td>${esc(x.label||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="chart-empty">Todavía no hay cambios registrados. Se añadirán al crear, editar o eliminar datos.</div>'}</div></div>`;}
  const bmmBaseRenderConfigFinal=renderConfig;
  renderConfig=function(){return bmmBaseRenderConfigFinal()+bmmAuditHTML()+`<section class="pro-card" style="margin-top:18px"><div class="pro-card-head"><div><h2>Sincronización y acceso</h2><p>La nube se activa al desplegar la aplicación en Netlify y configurar las variables secretas.</p></div><span class="audit-badge">${bmmCloudMode?(bmmAuthenticated?'Conectado':'Sin sesión'):'Modo local'}</span></div><div class="pro-card-body"><p>${bmmCloudMode?'Los cambios se sincronizan automáticamente después de guardar.':'Ahora los cambios se guardan en este dispositivo. Al publicar en Netlify se usará el almacenamiento compartido en la nube.'}</p><div class="toolbar"><button class="btn btn-primary" data-action="save-now">✓ Guardar ahora</button><button class="btn btn-soft" data-action="cloud-sync-now">↻ Sincronizar ahora</button><button class="btn btn-soft" data-action="logout">Cerrar sesión</button></div><div class="footnote">No se incluye ninguna contraseña en el código. La contraseña será el valor privado de APP_ACCESS_TOKEN configurado en Netlify.</div></div></section><section class="pro-card" style="margin-top:18px"><div class="pro-card-head"><div><h2>Instalar en Android</h2><p>Accede a la banda desde un icono en la pantalla de inicio, como una aplicación.</p></div><span class="audit-badge">PWA</span></div><div class="pro-card-body"><div class="pwa-install-note"><div class="pwa-install-icon">↗</div><div><h3>BMM Santa Cecilia en Chrome</h3><p>La instalación requiere publicar esta versión bajo HTTPS. En Chrome para Android, pulsa «Instalar app» si aparece en la cabecera; también puedes abrir el menú ⋮ del navegador y seleccionar «Instalar aplicación» o «Añadir a pantalla de inicio». El icono del escudo y la apertura a pantalla completa se cargarán automáticamente.</p></div></div></div></section>`;};

  function bmmDebouncedCloud(){if(!bmmCloudMode||!bmmAuthenticated)return;if(bmmSyncTimer)clearTimeout(bmmSyncTimer);bmmSyncTimer=setTimeout(bmmSyncNow,900);}
  function bmmScheduleCloudSave(){bmmDebouncedCloud();}
  async function bmmSyncNow(){if(!bmmCloudMode||!bmmAuthenticated||bmmSyncBusy)return false; bmmSyncBusy=true;try{const r=await fetch('/.netlify/functions/state',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({state})});if(!r.ok)throw new Error(r.status===401?'Sesión caducada. Vuelve a entrar.':'No se ha podido sincronizar.');const b=document.querySelector('.sidebar-bottom');if(b)b.innerHTML=`<div><span class="status-dot"></span>Guardado en la nube · ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div><div style="margin-top:9px">BMM Santa Cecilia · Sincronizado</div><div style="margin-top:9px"><button class="btn btn-soft btn-small" data-page="configuracion">Ver registro de cambios</button></div>`;showToast('Cambios sincronizados en la nube');return true;}catch(err){showToast(err.message||'Error de sincronización',true);return false}finally{bmmSyncBusy=false;}}
  async function bmmLoadCloud(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);try{const r=await fetch('/.netlify/functions/state',{credentials:'same-origin',signal:controller.signal,cache:'no-store'});if(!r.ok)return false;const data=await r.json();if(data?.state&&Array.isArray(data.state.events)&&Array.isArray(data.state.repertoire)){state=normalize(data.state);bmmAuthenticated=true;bmmCloudMode=true;try{localStorage.setItem(STORE_KEY,JSON.stringify(state))}catch(_){}return true}return false}catch(_){return false}finally{clearTimeout(timer);}}
  function bmmLoginUI(){if(document.getElementById('bmmLoginShell'))return;const shell=document.createElement('div');shell.id='bmmLoginShell';shell.className='login-shell';shell.innerHTML=`<section class="login-art"><div class="login-art-content"><img class="login-art-logo" src="assets/escudo-santa-cecilia.jpg" alt="Escudo de la Banda Santa Cecilia"><div class="eyebrow" style="color:#e4ca78">Banda Municipal de Música · Arjonilla</div><h1>BMM Santa Cecilia<br>de Arjonilla</h1><p>El repertorio, cada actuación y toda la historia musical de la banda, en un espacio seguro y organizado.</p></div></section><section class="login-card-wrap"><form class="login-card" id="bmmLoginForm"><img class="login-crest" src="assets/escudo-santa-cecilia.jpg" alt="Escudo Santa Cecilia"><div class="login-card-kicker">BMM · Santa Cecilia de Arjonilla</div><h2>Acceso a la banda</h2><p>Introduce la clave privada para acceder al repertorio, las actuaciones y la historia musical de la banda.</p><label for="bmmLoginToken">Contraseña de acceso</label><input id="bmmLoginToken" type="password" autocomplete="current-password" required placeholder="Introduce la clave"><label class="remember-session" style="display:flex;align-items:center;gap:10px;margin:14px 0;color:#52675d;font-size:14px;font-weight:500;text-transform:none;letter-spacing:0"><input id="bmmRememberSession" type="checkbox" style="width:18px;height:18px;accent-color:#17643f"> Recordar sesión en este dispositivo durante 30 días</label><div class="login-error" id="bmmLoginError" aria-live="polite"></div><button class="btn btn-primary" type="submit">Entrar en la aplicación</button>${bmmLocalHost()?'<button class="btn login-local" type="button" data-action="local-mode">Continuar en modo local</button>':''}<div class="footnote" style="margin-top:18px">Acceso privado · BMM Santa Cecilia de Arjonilla</div></form></section>`;document.body.appendChild(shell);shell.querySelector('#bmmLoginForm').addEventListener('submit',async e=>{e.preventDefault();const token=shell.querySelector('#bmmLoginToken').value;const err=shell.querySelector('#bmmLoginError');if(bmmLocalHost()){err.textContent='La validación del token se activa al publicar en Netlify. Para probar localmente, pulsa «Continuar en modo local».';return;}err.textContent='Comprobando acceso…';try{const authController=new AbortController();const authTimer=setTimeout(()=>authController.abort(),10000);let r;try{r=await fetch('/.netlify/functions/authenticate',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',signal:authController.signal,body:JSON.stringify({token,username:'BMM Santa Cecilia',remember:!!shell.querySelector('#bmmRememberSession')?.checked})});}finally{clearTimeout(authTimer);}const data=await r.json().catch(()=>({}));if(!r.ok||!data.authenticated)throw new Error(data.error||'La contraseña no es válida.');bmmCloudMode=true;bmmAuthenticated=true;const loaded=await bmmLoadCloud();if(!loaded){bmmAuthenticated=true;bmmCloudMode=true;throw new Error('Se ha validado el acceso, pero no se ha podido leer la copia de la nube. No se han enviado datos locales para evitar sobrescribir información compartida. Comprueba la conexión e inténtalo de nuevo.');}shell.remove();render();bmmRefreshStatus();showToast('Sesión iniciada');}catch(ex){err.textContent=ex.name==='AbortError'?'El servidor ha tardado demasiado en responder. Recarga la página e inténtalo de nuevo.':(ex.message||'No se ha podido iniciar sesión.');}});}
  async function bmmInitAuth(){if(bmmLocalHost()){bmmCloudMode=false;bmmAuthenticated=false;bmmLoginUI();return;}bmmCloudMode=true;document.documentElement.classList.add('bmm-auth-check');const shell=document.createElement('div');shell.id='bmmLoginShell';shell.className='login-shell';shell.innerHTML='<section class="login-card-wrap"><div class="login-card"><img class="login-crest" src="assets/escudo-santa-cecilia.jpg" alt="Escudo Santa Cecilia"><h2>Comprobando sesión…</h2><p>Un momento, estamos verificando el acceso.</p></div></section>';document.body.appendChild(shell);let ok=false;try{ok=await bmmLoadCloud();}catch(_){ok=false;}finally{shell.remove();document.documentElement.classList.remove('bmm-auth-check');}if(ok){render();bmmRefreshStatus();if(bmmCloudStartupSyncNeeded&&!bmmCloudConflictState&&!bmmHasUnresolvedLocalRecovery()&&!bmmFormDirty){bmmCloudStartupSyncNeeded=false;showToast('Se conservaron los cambios locales pendientes sobre la misma versión de nube. Sincronizando…');setTimeout(()=>{if(bmmCloudMode&&bmmAuthenticated&&bmmCloudPending&&!bmmCloudConflictState&&!bmmHasUnresolvedLocalRecovery()&&!bmmFormDirty)bmmSyncNow();},350);}if(bmmCloudAutoCompletionPending>0&&!bmmCloudConflictState&&!bmmHasUnresolvedLocalRecovery()&&!bmmFormDirty){const count=bmmCloudAutoCompletionPending;const saved=save(`Actuaciones completadas automáticamente por fecha (${count})`);if(saved!==false){bmmCloudAutoCompletionPending=0;showToast(`${count} actuación${count===1?'':'es'} anterior${count===1?'':'es'} marcada${count===1?'':'s'} como realizada${count===1?'':'s'} y pendiente de sincronización.`);}}}else{bmmLoginUI();const err=document.getElementById('bmmLoginError');if(err)err.textContent='No se ha encontrado una sesión activa. Introduce la clave de acceso para continuar.';}}
  const bmmHandleBeforeMemberActions=handleAction;
  handleAction=function(el){
    const a=el.dataset.action,id=el.dataset.id;
    if(a==='move-march-up'||a==='move-march-down'||a==='duplicate-march-row'){
      const row=el.closest('.march-row'),wrap=document.getElementById('marchRows');
      if(!row||!wrap)return;
      const rows=()=>[...wrap.querySelectorAll('.march-row')];
      const renumber=()=>rows().forEach((r,i)=>{const order=r.querySelector('[name="order"]');if(order)order.value=String(i+1);const source=r.querySelector('[name="sourceStop"]');if(source)source.value=String(i+1);});
      if(a==='move-march-up'){
        const prev=row.previousElementSibling;if(!prev)return;wrap.insertBefore(row,prev);renumber();showToast('Marcha subida de posición');return;
      }
      if(a==='move-march-down'){
        const next=row.nextElementSibling;if(!next)return;wrap.insertBefore(next,row);renumber();showToast('Marcha bajada de posición');return;
      }
      const copy=row.cloneNode(true);const originalFields=[...row.querySelectorAll('[name]')],copyFields=[...copy.querySelectorAll('[name]')];originalFields.forEach((field,i)=>{const target=copyFields[i];if(!target)return;if(field.type==='checkbox'||field.type==='radio')target.checked=field.checked;else target.value=field.value;});row.insertAdjacentElement('afterend',copy);renumber();
      const select=copy.querySelector('select[name="marchId"]');if(select)select.focus();
      showToast('Aparición duplicada. Puedes cambiar su ubicación, hora u observaciones.');return;
    }
    if(a==='add-member'){bmmOpenMemberForm(null);return;}
    if(a==='edit-member'){const m=(state.members||[]).find(x=>x.id===id);if(m)bmmOpenMemberForm(m);return;}
    if(a==='delete-member'){const m=(state.members||[]).find(x=>x.id===id);if(m&&confirm(`¿Eliminar la ficha de ${m.name}? Esta acción no elimina información de actuaciones ni del repertorio.`)){state.members=state.members.filter(x=>x.id!==id);save('Integrante eliminado: '+m.name);setPage('integrantes');}return;}
    if(a==='member-insight'){const m=(state.members||[]).find(x=>x.id===id);if(m)bmmOpenMemberInsight(m);return;}
    if(a==='member-pdf'){const m=(state.members||[]).find(x=>x.id===id);if(m)bmmPrintObjectReport('Ficha de integrante · '+m.name,bmmMemberReportBody([m],'Ficha de integrante · '+m.name));return;}
    if(a==='members-pdf'){const rows=bmmCurrentMembers();if(!rows.length){showToast('No hay integrantes para incluir en el informe.',true);return;}bmmPrintObjectReport('Integrantes de la banda',bmmMemberReportBody(rows));return;}
    if(a==='members-csv'){bmmDownloadMembersCSV();return;}
    if(a==='members-reset-filters'){bmmMemberSearch='';bmmMemberInstrument='all';bmmMemberYear='all';bmmMemberStatus='all';render();showToast('Filtros de integrantes restablecidos');return;}
    return bmmHandleBeforeMemberActions(el);
  };
  document.addEventListener('click',function(e){const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;if(a==='reset-global-filters'){Object.assign(bmmGlobal,{q:'',year:'all',group:'all',category:'all',from:'',to:''});actSearch='';actCategory='all';actYear='all';repSearch='';repStyle='all';bmmTimelineSearch='';bmmTimelineYear='all';bmmTimelineGroup='all';bmmTimelineType='all';bmmAnalyticsYear='all';bmmAnalyticsMetric='plays';bmmGroupSearch='';reportSearch='';reportYear='all';reportGroup='all';reportCategory='all';reportFrom='';reportTo='';render();showToast('Todos los filtros restablecidos');return;}
    if(a==='save-now'){if(bmmFormDirty){showToast('Hay un formulario con cambios sin confirmar. Pulsa Guardar dentro del formulario y después sincroniza.',true);return;}bmmAddAudit('Guardado manual solicitado','Guardado');try{localStorage.setItem(STORE_KEY,JSON.stringify(state));bmmDataStatusError=false;bmmCloudPending=!!(bmmCloudMode&&bmmAuthenticated);bmmFlashSaveState('Guardado');showToast('Cambios guardados en este dispositivo');}catch(_){bmmDataStatusError=true;bmmFlashSaveState('Error al guardar');showToast('No se pudo guardar localmente',true)}if(bmmCloudMode&&bmmAuthenticated){bmmFlashSaveState('Sincronizando…',8000);bmmSyncNow().then(ok=>bmmFlashSaveState(ok?'Guardado':'Reintentar')).catch(()=>bmmFlashSaveState('Reintentar'));}render();return;}
    if(a==='cloud-sync-now'){bmmSyncNow();return;}
    if(a==='local-mode'){document.getElementById('bmmLoginShell')?.remove();bmmCloudMode=false;bmmAuthenticated=false;render();showToast('Modo local activado');return;}
    if(a==='logout'){if(bmmCloudMode){fetch('/.netlify/functions/logout',{method:'POST',credentials:'same-origin'}).catch(()=>{});bmmAuthenticated=false;bmmLoginUI();}else showToast('Estás trabajando en modo local.');return;}
    if(a==='export-audit'){const rows=[['Fecha','Sección','Tipo','Detalle'],...bmmGetAudit().map(x=>[x.at,bmmPageNames[x.page]||x.page,x.kind,x.label])];download(`bmm-santa-cecilia-registro-cambios-${bmmTodayKey()}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');return;}
    if(a==='clear-audit'){if(confirm('¿Vaciar el registro de cambios? Esta acción también quedará registrada.')){state.auditLog=[];bmmAddAudit('Se vació el historial anterior','Administración');save('Registro de cambios reiniciado');}return;}
  });


  // Preferencia visual: automático por dispositivo de forma predeterminada.
  const BMM_THEME_KEY='bmm-santa-cecilia-theme-mode-v1';
  let bmmThemeMode='auto';
  try { const storedTheme=localStorage.getItem(BMM_THEME_KEY); if(['auto','light','dark'].includes(storedTheme)) bmmThemeMode=storedTheme; } catch(_) {}
  function bmmApplyTheme(){
    document.documentElement.dataset.bmmTheme=bmmThemeMode;
    document.documentElement.dataset.bmmPage=page||'dashboard';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta){
      const dark=bmmThemeMode==='dark'||(bmmThemeMode==='auto'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content',dark?'#091710':'#0b3527');
    }
  }
  function bmmThemeSettingsMarkup(){
    const choices=[
      {id:'auto',icon:'◐',title:'Automático',desc:'Sigue la apariencia del dispositivo',tag:'Recomendado'},
      {id:'light',icon:'☀',title:'Modo claro',desc:'Marfil, verde y dorado luminosos',tag:''},
      {id:'dark',icon:'☾',title:'Modo oscuro',desc:'Verde nocturno cómodo para poca luz',tag:''}
    ];
    return `<section class="pro-card bmm-theme-settings">
      <div class="bmm-theme-settings-glow" aria-hidden="true"></div>
      <div class="pro-card-head"><div><div class="bmm-theme-kicker">TU ESPACIO · TU ESTILO</div><h2>Apariencia de la aplicación</h2><p>Personaliza cómo ves el registro musical. La elección se recuerda en este dispositivo.</p></div><span class="audit-badge">Diseño</span></div>
      <div class="pro-card-body">
        <div class="bmm-theme-options" role="radiogroup" aria-label="Modo de apariencia">
          ${choices.map(c=>`<label class="bmm-theme-option ${bmmThemeMode===c.id?'selected':''}" data-theme-option="${esc(c.id)}">
            <input type="radio" name="bmmThemeMode" value="${esc(c.id)}" ${bmmThemeMode===c.id?'checked':''}>
            <span class="bmm-theme-symbol" aria-hidden="true">${c.icon}</span>
            <span class="bmm-theme-copy"><strong>${c.title}</strong><small>${c.desc}</small>${c.tag?`<em>${c.tag}</em>`:''}</span>
            <span class="bmm-theme-check" aria-hidden="true">✓</span>
          </label>`).join('')}
        </div>
        <div class="bmm-theme-note"><span class="bmm-theme-note-dot"></span><span>${bmmThemeMode==='auto'?'El tema cambia automáticamente cuando cambia la preferencia de tu móvil, tablet u ordenador.':bmmThemeMode==='dark'?'Modo oscuro activado. Los colores se han ajustado para mantener el contraste y la legibilidad.':'Modo claro activado. Se mantiene la identidad verde, dorada y marfil de la banda.'}</span></div>
      </div>
    </section>`;
  }
  const bmmRenderConfigBeforeTheme=renderConfig;
  renderConfig=function(){return bmmThemeSettingsMarkup()+bmmRenderConfigBeforeTheme();};
  document.addEventListener('change',function(e){
    const input=e.target;
    if(!input||input.name!=='bmmThemeMode')return;
    const next=input.value;
    if(!['auto','light','dark'].includes(next))return;
    bmmThemeMode=next;
    try{localStorage.setItem(BMM_THEME_KEY,next);}catch(_){}
    bmmApplyTheme();
    // The appearance preference belongs to this device only. It must not alter
    // the shared musical state, the cloud revision or the audit trail.
    render();
    showToast('Apariencia: '+({auto:'automática',light:'modo claro',dark:'modo oscuro'}[next]));
  },true);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{
    if(bmmThemeMode==='auto')bmmApplyTheme();
  });
  const bmmRenderWithThemeState=render;
  render=function(){bmmApplyTheme();return bmmRenderWithThemeState();};

  // Keep user-friendly labels instead of technical BI jargon.
  document.addEventListener('DOMContentLoaded',()=>{});
  const bmmTextObserver=new MutationObserver(()=>{document.querySelectorAll('h1,h2,h3,.eyebrow,.stat-top,.pro-kpi-label,.hero-kpi span,.pro-kpi-meta').forEach(n=>{if(n.childElementCount===0&&n.textContent.includes('KPI'))n.textContent=n.textContent.replace(/KPIs?/g,'Indicadores')})});
  try{bmmTextObserver.observe(document.getElementById('content'),{subtree:true,childList:true,characterData:true})}catch(_){}
  // PWA: install on Android Chrome when served over HTTPS (localhost is allowed for development).
  let bmmDeferredInstallPrompt = null;
  const bmmPwaSecureContext = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  const bmmPwaStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  function bmmUpdateInstallButton(){
    const host=document.querySelector('.top-right'); if(!host)return;
    let btn=document.getElementById('bmmPwaInstallBtn');
    if(!btn){btn=document.createElement('button');btn.type='button';btn.id='bmmPwaInstallBtn';btn.className='btn btn-soft';btn.textContent='⇩ Instalar app';btn.setAttribute('aria-label','Instalar BMM Santa Cecilia como aplicación');btn.addEventListener('click',async()=>{
      if(bmmDeferredInstallPrompt){const promptEvent=bmmDeferredInstallPrompt;bmmDeferredInstallPrompt=null;try{await promptEvent.prompt();const result=await promptEvent.userChoice;if(result?.outcome==='accepted')showToast('Instalación iniciada');else showToast('Puedes instalarla más tarde desde el menú de Chrome');}catch(_){showToast('Para instalarla, abre el menú ⋮ de Chrome y pulsa «Instalar aplicación».');}bmmUpdateInstallButton();}
      else showToast('En Chrome Android, abre el menú ⋮ y elige «Instalar aplicación» o «Añadir a pantalla de inicio».');
    });host.appendChild(btn);}
    btn.hidden=!bmmPwaSecureContext||bmmPwaStandalone;
  }
  const bmmPreviousRefreshTopbar=bmmRefreshTopbar;
  bmmRefreshTopbar=function(){bmmPreviousRefreshTopbar();bmmUpdateInstallButton();};
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();bmmDeferredInstallPrompt=event;bmmUpdateInstallButton();});
  window.addEventListener('appinstalled',()=>{bmmDeferredInstallPrompt=null;bmmUpdateInstallButton();showToast('BMM Santa Cecilia se ha instalado correctamente');});
  if('serviceWorker' in navigator && bmmPwaSecureContext){navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!window.__bmmReloadedForWorker){window.__bmmReloadedForWorker=true;window.location.reload();}});window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>{reg.update().catch(()=>{});if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage({type:'SKIP_WAITING'});});});}).catch(err=>console.warn('No se ha podido registrar el service worker:',err));});}

  // Start with an authenticated cloud session on Netlify; local files remain available without credentials.
  // Final CSS override is injected last so it wins over legacy responsive rules.
  const bmmFinalStyle=document.createElement('style');
  bmmFinalStyle.id='bmmFinalLayoutOverrides';
  bmmFinalStyle.textContent=`
    .top-right .btn:before{content:none!important;display:none!important}
    .bmm-floating-save{position:fixed;right:24px;bottom:24px;z-index:19;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:0 20px;border:1px solid rgba(225,202,125,.78);border-radius:999px;background:linear-gradient(135deg,#176744,#0b3c29);color:#fffdf4;font-weight:750;font-size:13px;letter-spacing:.1px;box-shadow:0 10px 28px rgba(9,43,29,.24),inset 0 1px 0 rgba(255,255,255,.15);transition:transform .18s,box-shadow .18s,background .18s}
    .bmm-floating-save:hover{transform:translateY(-2px);box-shadow:0 14px 32px rgba(9,43,29,.3)}.bmm-floating-save:active{transform:translateY(0)}
    .bmm-floating-save .bmm-save-icon{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:#ffffff1c;border:1px solid #ffffff46;font-size:14px}
    .bmm-floating-save.is-saved{background:linear-gradient(135deg,#2b8462,#135338)}
    .nav button.active{background:linear-gradient(100deg,#176744,#0b3c29)!important;color:white!important;border:1px solid #c9a96e!important}
    @media(max-width:760px){
      .top-right .btn{font-size:12px!important;width:auto!important;min-width:0!important;height:auto!important;padding:8px 10px!important;border-radius:9px!important}
      .top-right .btn:before{content:none!important;display:none!important}#bmmPwaInstallBtn{display:none!important}
      .content{padding-bottom:calc(108px + env(safe-area-inset-bottom))!important}
      .bmm-floating-save{right:14px;bottom:calc(16px + env(safe-area-inset-bottom));min-height:46px;padding:0 16px;font-size:12px;gap:8px;box-shadow:0 7px 20px rgba(9,43,29,.28)}
      .bmm-floating-save .bmm-save-icon{width:21px;height:21px}
      body:has(#bmmLoginShell) .bmm-floating-save{display:none!important}
    }
    @media(min-width:761px){body:has(#bmmLoginShell) .bmm-floating-save{display:none!important}}
  `;
  document.head.appendChild(bmmFinalStyle);
  const bmmThemeStyle=document.createElement('style');
  bmmThemeStyle.id='bmmAppearanceAndThemeStyles';
  bmmThemeStyle.textContent=`
    /* Individual section accents add variety without leaving the band identity. */
    html{color-scheme:light}
    html[data-bmm-theme="light"]{color-scheme:light;--ink:#17372a;--muted:#758278;--bg:#f4f6f0;--paper:#fffef9;--nav:#082f22;--nav2:#155237;--red:#17613e;--red2:#26784c;--gold:#cfb45d;--line:#e0e7dc;--green:#286f4c;--shadow:0 12px 32px rgba(10,44,30,.07)}
    html[data-bmm-theme="dark"]{color-scheme:dark;--ink:#eaf3eb;--muted:#a2b7a7;--bg:#0b1711;--paper:#14251b;--nav:#041e15;--nav2:#0c3523;--red:#68c18b;--red2:#8bd9a7;--gold:#e1c66c;--line:#2b4032;--green:#65bd8a;--shadow:0 16px 38px rgba(0,0,0,.23)}
    @media(prefers-color-scheme:dark){html[data-bmm-theme="auto"]{color-scheme:dark;--ink:#eaf3eb;--muted:#a2b7a7;--bg:#0b1711;--paper:#14251b;--nav:#041e15;--nav2:#0c3523;--red:#68c18b;--red2:#8bd9a7;--gold:#e1c66c;--line:#2b4032;--green:#65bd8a;--shadow:0 16px 38px rgba(0,0,0,.23)}}
    @media(prefers-color-scheme:light){html[data-bmm-theme="auto"]{color-scheme:light}}
    html[data-bmm-page="dashboard"]{--section-accent:#c4a343;--section-tint:#f5efd9}
    html[data-bmm-page="actuaciones"]{--section-accent:#287a50;--section-tint:#e3f0e6}
    html[data-bmm-page="cronologia"]{--section-accent:#318b91;--section-tint:#e0f0ed}
    html[data-bmm-page="repertorio"]{--section-accent:#a37932;--section-tint:#f6ebd8}
    html[data-bmm-page="analitica"]{--section-accent:#6679b5;--section-tint:#e8ecfa}
    html[data-bmm-page="grupos"]{--section-accent:#9d6b45;--section-tint:#f4e8de}
    html[data-bmm-page="informes"]{--section-accent:#b18a35;--section-tint:#f6efd9}
    html[data-bmm-page="configuracion"]{--section-accent:#498c76;--section-tint:#e3f0e9}
    html[data-bmm-theme="dark"][data-bmm-page="dashboard"]{--section-accent:#e1c66c;--section-tint:#342c18}
    html[data-bmm-theme="dark"][data-bmm-page="actuaciones"]{--section-accent:#68c18b;--section-tint:#163323}
    html[data-bmm-theme="dark"][data-bmm-page="cronologia"]{--section-accent:#6ac9c3;--section-tint:#153232}
    html[data-bmm-theme="dark"][data-bmm-page="repertorio"]{--section-accent:#e2b96c;--section-tint:#382b18}
    html[data-bmm-theme="dark"][data-bmm-page="analitica"]{--section-accent:#a5b5ff;--section-tint:#202945}
    html[data-bmm-theme="dark"][data-bmm-page="grupos"]{--section-accent:#e0a984;--section-tint:#38251d}
    html[data-bmm-theme="dark"][data-bmm-page="informes"]{--section-accent:#e1c66c;--section-tint:#342c18}
    html[data-bmm-theme="dark"][data-bmm-page="configuracion"]{--section-accent:#76cdb0;--section-tint:#17352b}
    @media(prefers-color-scheme:dark){
      html[data-bmm-theme="auto"][data-bmm-page="dashboard"],html[data-bmm-theme="dark"][data-bmm-page="dashboard"]{--section-accent:#e1c66c;--section-tint:#342c18}
      html[data-bmm-theme="auto"][data-bmm-page="actuaciones"],html[data-bmm-theme="dark"][data-bmm-page="actuaciones"]{--section-accent:#68c18b;--section-tint:#163323}
      html[data-bmm-theme="auto"][data-bmm-page="cronologia"],html[data-bmm-theme="dark"][data-bmm-page="cronologia"]{--section-accent:#6ac9c3;--section-tint:#153232}
      html[data-bmm-theme="auto"][data-bmm-page="repertorio"],html[data-bmm-theme="dark"][data-bmm-page="repertorio"]{--section-accent:#e2b96c;--section-tint:#382b18}
      html[data-bmm-theme="auto"][data-bmm-page="analitica"],html[data-bmm-theme="dark"][data-bmm-page="analitica"]{--section-accent:#a5b5ff;--section-tint:#202945}
      html[data-bmm-theme="auto"][data-bmm-page="grupos"],html[data-bmm-theme="dark"][data-bmm-page="grupos"]{--section-accent:#e0a984;--section-tint:#38251d}
      html[data-bmm-theme="auto"][data-bmm-page="informes"],html[data-bmm-theme="dark"][data-bmm-page="informes"]{--section-accent:#e1c66c;--section-tint:#342c18}
      html[data-bmm-theme="auto"][data-bmm-page="configuracion"],html[data-bmm-theme="dark"][data-bmm-page="configuracion"]{--section-accent:#76cdb0;--section-tint:#17352b}
    }
    body{background:radial-gradient(ellipse at 78% 0%,color-mix(in srgb,var(--section-accent,#c4a343) 8%,var(--bg)) 0%,var(--bg) 54%,var(--bg) 100%)!important;color:var(--ink)!important;transition:background-color .22s,color .22s}
    .topbar{background:color-mix(in srgb,var(--paper) 92%,transparent)!important;border-bottom:2px solid color-mix(in srgb,var(--section-accent,#c4a343) 45%,var(--line))!important;box-shadow:0 7px 24px rgba(10,44,30,.035)}
    .topbar .top-title{color:var(--ink)!important}
    .crumb,.card-sub,.page-head p,.section-filter-note,.footnote,.card-subtitle,.stat-foot{color:var(--muted)!important}
    .page-head{position:relative;isolation:isolate;overflow:hidden;padding:clamp(17px,2.2vw,25px)!important;border:1px solid var(--line)!important;border-left:4px solid var(--section-accent,#c4a343)!important;border-radius:var(--radius,19px);background:linear-gradient(115deg,color-mix(in srgb,var(--section-tint,#f5efd9) 75%,var(--paper)),var(--paper) 76%)!important;box-shadow:0 10px 26px rgba(10,44,30,.045)}
    .page-head:after{content:"";position:absolute;right:-55px;top:-85px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--section-accent,#c4a343) 13%,transparent),transparent 70%);z-index:-1;pointer-events:none}
    .page-head .eyebrow,.eyebrow{color:var(--section-accent,#287a50)!important}
    .stats .stat-card{position:relative;overflow:hidden;border-top:3px solid var(--stat-accent,var(--section-accent,#c4a343))!important;background:linear-gradient(145deg,var(--paper),color-mix(in srgb,var(--stat-accent,var(--section-accent,#c4a343)) 6%,var(--paper)))!important;transition:transform .18s,box-shadow .18s}
    .stats .stat-card:nth-child(1){--stat-accent:#2c8756}.stats .stat-card:nth-child(2){--stat-accent:#c19a39}.stats .stat-card:nth-child(3){--stat-accent:#398f99}.stats .stat-card:nth-child(4){--stat-accent:#8c73b6}
    .stat-icon{background:color-mix(in srgb,var(--stat-accent,var(--section-accent,#c4a343)) 13%,var(--paper))!important;color:var(--stat-accent,var(--section-accent,#c4a343))!important;border-radius:12px}
    .stats .stat-card:hover{transform:translateY(-3px);box-shadow:0 17px 32px rgba(10,44,30,.10)}
    .card,.global-filterbar,.filterbar,.setting-card,.table-card,.report-event,.member-card,.member-empty,.member-fact,.report-preview,.group-card,.timeline-card{color:var(--ink)}
    .card,.global-filterbar,.filterbar,.setting-card,.table-card,.report-event,.member-card,.member-empty,.member-fact,.report-preview,.group-card,.timeline-card{background:var(--paper)!important;border-color:var(--line)!important;box-shadow:var(--shadow,0 12px 32px rgba(10,44,30,.07))}
    input:not([type=checkbox]):not([type=radio]),select,textarea{background:var(--paper)!important;color:var(--ink)!important;border-color:var(--line)!important}
    input::placeholder,textarea::placeholder{color:var(--muted)!important;opacity:.85}
    .btn-soft,.icon-btn{background:color-mix(in srgb,var(--paper) 92%,var(--section-tint,#e4efe6))!important;border-color:var(--line)!important;color:var(--ink)!important}
    .btn-soft:hover,.icon-btn:hover{border-color:var(--section-accent,#c4a343)!important;transform:translateY(-1px)}
    .data-table th,.audit-table th{background:color-mix(in srgb,var(--section-tint,#e4efe6) 70%,var(--paper))!important;color:var(--ink)!important;border-color:var(--line)!important}
    .data-table td,.audit-table td{border-color:var(--line)!important;color:var(--ink)}
    .data-table tr:nth-child(even),.audit-table tr:nth-child(even){background:color-mix(in srgb,var(--paper) 86%,var(--section-tint,#e4efe6))!important}
    .event-accordion,.group-accordion,.year-accordion{border-color:var(--line)!important}
    .event-accordion>summary,.group-accordion>summary,.year-accordion>summary{background:color-mix(in srgb,var(--paper) 90%,var(--section-tint,#e4efe6))!important;color:var(--ink)!important}
    .modal{background:var(--paper)!important;color:var(--ink)!important;border-color:var(--line)!important}
    .modal h1,.modal h2,.modal h3,.card h1,.card h2,.card h3,.pro-card h1,.pro-card h2,.pro-card h3{color:var(--ink)}
    .bmm-theme-settings{position:relative;overflow:hidden;margin-bottom:18px;border:1px solid color-mix(in srgb,var(--gold) 35%,var(--line))!important;background:linear-gradient(135deg,color-mix(in srgb,var(--section-tint,#f5efd9) 74%,var(--paper)),var(--paper) 64%)!important}
    .bmm-theme-settings .pro-card-head{position:relative;z-index:1}.bmm-theme-settings-glow{position:absolute;right:-45px;top:-75px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--gold) 20%,transparent),transparent 68%);pointer-events:none}
    .bmm-theme-kicker{font-size:10px;font-weight:850;letter-spacing:1.7px;color:var(--section-accent,#c4a343);margin-bottom:6px}
    .bmm-theme-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .bmm-theme-option{position:relative;display:flex;align-items:flex-start;gap:11px;min-width:0;min-height:106px;padding:15px 13px;border:1px solid var(--line);border-radius:15px;background:var(--paper);cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s}
    .bmm-theme-option:hover{transform:translateY(-2px);box-shadow:0 9px 22px rgba(10,44,30,.08);border-color:var(--section-accent,#c4a343)}
    .bmm-theme-option.selected{border:1.5px solid var(--section-accent,#c4a343);background:linear-gradient(145deg,color-mix(in srgb,var(--section-tint,#f5efd9) 80%,var(--paper)),var(--paper));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--section-accent,#c4a343) 12%,transparent)}
    .bmm-theme-option input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
    .bmm-theme-symbol{display:grid;place-items:center;flex:0 0 38px;height:38px;border-radius:12px;background:color-mix(in srgb,var(--section-accent,#c4a343) 14%,var(--paper));color:var(--section-accent,#c4a343);font-size:21px}
    .bmm-theme-copy{display:flex;flex-direction:column;gap:4px;min-width:0}.bmm-theme-copy strong{font-size:13px;color:var(--ink)}.bmm-theme-copy small{font-size:11px;line-height:1.4;color:var(--muted)}.bmm-theme-copy em{align-self:flex-start;margin-top:3px;padding:3px 6px;border-radius:99px;background:color-mix(in srgb,var(--section-accent,#c4a343) 15%,var(--paper));font-size:9px;font-style:normal;font-weight:800;color:var(--section-accent,#287a50)}
    .bmm-theme-check{display:none;position:absolute;right:10px;top:10px;width:20px;height:20px;border-radius:50%;background:var(--section-accent,#287a50);color:white;font-size:12px;place-items:center}.bmm-theme-option.selected .bmm-theme-check{display:grid}
    .bmm-theme-note{display:flex;align-items:center;gap:9px;margin-top:14px;padding:12px 14px;border-radius:12px;background:color-mix(in srgb,var(--section-tint,#e4efe6) 70%,var(--paper));color:var(--muted);font-size:12px}.bmm-theme-note-dot{width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:var(--section-accent,#287a50);box-shadow:0 0 0 4px color-mix(in srgb,var(--section-accent,#287a50) 14%,transparent)}
    .bmm-theme-settings .pro-card-body{position:relative;z-index:1}
    /* Additional component polish; keep the dashboard vivid without flattening every panel. */
    .pro-kpi .pro-kpi-label,.pro-kpi .pro-kpi-meta{color:var(--muted)!important}
    .pro-kpi .pro-kpi-value{color:var(--ink)!important}
    .event-card-head{background:linear-gradient(110deg,var(--paper),color-mix(in srgb,var(--section-tint,#f5efd9) 68%,var(--paper)))!important;border-color:var(--line)!important}
    .group-tile{background:linear-gradient(145deg,var(--paper),color-mix(in srgb,var(--section-tint,#e3f0e6) 70%,var(--paper)))!important;border-color:var(--line)!important;color:var(--ink)!important}
    .mini-chart{border-color:var(--line)!important}
    .chart-legend,.chart-label,.timeline-date,.timeline-meta{color:var(--muted)!important}
    .stat-card .stat-value{letter-spacing:-.8px}
    .filterbar,.global-filterbar{backdrop-filter:blur(8px)}
    .card,.pro-card,.global-filterbar,.filterbar,.setting-card,.table-card,.member-card,.event-card,.group-tile{transition:background-color .2s,border-color .2s,box-shadow .2s,transform .18s}
    .btn-primary{background:linear-gradient(135deg,#1e704a,#0c4c30)!important}
    .btn-primary:hover{filter:brightness(1.07)}
    /* Dark theme adaptions for legacy cards, controls and the login screen. */
    html[data-bmm-theme="dark"] body,html[data-bmm-theme="dark"] .main,
    html[data-bmm-theme="dark"] .content{background-color:var(--bg)!important;color:var(--ink)!important}
    html[data-bmm-theme="dark"] .card,html[data-bmm-theme="dark"] .global-filterbar,html[data-bmm-theme="dark"] .filterbar,html[data-bmm-theme="dark"] .setting-card,html[data-bmm-theme="dark"] .table-card,html[data-bmm-theme="dark"] .report-event,html[data-bmm-theme="dark"] .member-card,html[data-bmm-theme="dark"] .member-empty,html[data-bmm-theme="dark"] .member-fact,html[data-bmm-theme="dark"] .report-preview,html[data-bmm-theme="dark"] .group-card,html[data-bmm-theme="dark"] .timeline-card,html[data-bmm-theme="dark"] .bmm-theme-option{background:var(--paper)!important;border-color:var(--line)!important;color:var(--ink)!important}
    html[data-bmm-theme="dark"] .page-head{background:linear-gradient(115deg,color-mix(in srgb,var(--section-tint,#1a3323) 72%,var(--paper)),var(--paper) 80%)!important;border-color:var(--line)!important}
    html[data-bmm-theme="dark"] .stats .stat-card{background:linear-gradient(145deg,var(--paper),color-mix(in srgb,var(--stat-accent,var(--section-accent)) 12%,var(--paper)))!important}
    html[data-bmm-theme="dark"] .btn-soft,html[data-bmm-theme="dark"] .icon-btn{background:#1d3024!important;border-color:var(--line)!important;color:var(--ink)!important}
    html[data-bmm-theme="dark"] .data-table th,html[data-bmm-theme="dark"] .audit-table th{background:#203429!important;color:var(--ink)!important}
    html[data-bmm-theme="dark"] .data-table tr:nth-child(even),html[data-bmm-theme="dark"] .audit-table tr:nth-child(even){background:#182a20!important}
    html[data-bmm-theme="dark"] .pro-kpi .pro-kpi-label,html[data-bmm-theme="dark"] .pro-kpi .pro-kpi-meta{color:var(--muted)!important}
    html[data-bmm-theme="dark"] .pro-kpi .pro-kpi-value{color:var(--ink)!important}
    html[data-bmm-theme="dark"] .event-card-head,html[data-bmm-theme="dark"] .group-tile{background:linear-gradient(110deg,#14251b,#1a3022)!important;border-color:var(--line)!important;color:var(--ink)!important}
    html[data-bmm-theme="dark"] .member-avatar{background:#233b2a!important;color:#b6e4c2!important;border-color:var(--line)!important}
    html[data-bmm-theme="dark"] .login-shell{background:#0b1711!important}
    html[data-bmm-theme="dark"] .login-card-wrap{background:#0b1711!important}
    html[data-bmm-theme="dark"] .login-card{background:#14251b!important;border-color:#2b4032!important;color:#eaf3eb!important}
    html[data-bmm-theme="dark"] .login-card h2,html[data-bmm-theme="dark"] .login-card p,html[data-bmm-theme="dark"] .login-card label{color:#eaf3eb!important}
    html[data-bmm-theme="dark"] .login-card input{background:#0d1c13!important;color:#eaf3eb!important;border-color:#304839!important}
    @media(prefers-color-scheme:dark){
      html[data-bmm-theme="auto"] body,html[data-bmm-theme="auto"] .main,html[data-bmm-theme="auto"] .content{background-color:var(--bg)!important;color:var(--ink)!important}
      html[data-bmm-theme="auto"] .card,html[data-bmm-theme="auto"] .global-filterbar,html[data-bmm-theme="auto"] .filterbar,html[data-bmm-theme="auto"] .setting-card,html[data-bmm-theme="auto"] .table-card,html[data-bmm-theme="auto"] .report-event,html[data-bmm-theme="auto"] .member-card,html[data-bmm-theme="auto"] .member-empty,html[data-bmm-theme="auto"] .member-fact,html[data-bmm-theme="auto"] .report-preview,html[data-bmm-theme="auto"] .group-card,html[data-bmm-theme="auto"] .timeline-card,html[data-bmm-theme="auto"] .bmm-theme-option{background:var(--paper)!important;border-color:var(--line)!important;color:var(--ink)!important}
      html[data-bmm-theme="auto"] .page-head{background:linear-gradient(115deg,color-mix(in srgb,var(--section-tint,#1a3323) 72%,var(--paper)),var(--paper) 80%)!important;border-color:var(--line)!important}
      html[data-bmm-theme="auto"] .stats .stat-card{background:linear-gradient(145deg,var(--paper),color-mix(in srgb,var(--stat-accent,var(--section-accent)) 12%,var(--paper)))!important}
      html[data-bmm-theme="auto"] .btn-soft,html[data-bmm-theme="auto"] .icon-btn{background:#1d3024!important;border-color:var(--line)!important;color:var(--ink)!important}
      html[data-bmm-theme="auto"] .data-table th,html[data-bmm-theme="auto"] .audit-table th{background:#203429!important;color:var(--ink)!important}
      html[data-bmm-theme="auto"] .data-table tr:nth-child(even),html[data-bmm-theme="auto"] .audit-table tr:nth-child(even){background:#182a20!important}
      html[data-bmm-theme="auto"] .login-shell,html[data-bmm-theme="auto"] .login-card-wrap{background:#0b1711!important}
      html[data-bmm-theme="auto"] .login-card{background:#14251b!important;border-color:#2b4032!important;color:#eaf3eb!important}
      html[data-bmm-theme="auto"] .login-card h2,html[data-bmm-theme="auto"] .login-card p,html[data-bmm-theme="auto"] .login-card label{color:#eaf3eb!important}
      html[data-bmm-theme="auto"] .login-card input{background:#0d1c13!important;color:#eaf3eb!important;border-color:#304839!important}
      html[data-bmm-theme="auto"] .pro-kpi .pro-kpi-label,html[data-bmm-theme="auto"] .pro-kpi .pro-kpi-meta{color:var(--muted)!important}
      html[data-bmm-theme="auto"] .pro-kpi .pro-kpi-value{color:var(--ink)!important}
      html[data-bmm-theme="auto"] .event-card-head,html[data-bmm-theme="auto"] .group-tile{background:linear-gradient(110deg,#14251b,#1a3022)!important;border-color:var(--line)!important;color:var(--ink)!important}
      html[data-bmm-theme="auto"] .member-avatar{background:#233b2a!important;color:#b6e4c2!important;border-color:var(--line)!important}
    }
    @media(max-width:760px){.page-head{padding:15px!important;border-radius:15px!important}.bmm-theme-options{grid-template-columns:1fr;gap:8px}.bmm-theme-option{min-height:0;align-items:center;padding:12px}.bmm-theme-option .bmm-theme-copy small{font-size:11px}.bmm-theme-symbol{flex-basis:35px;height:35px}.bmm-theme-settings .pro-card-head{padding:16px 16px 12px!important}.bmm-theme-settings .pro-card-body{padding:0 16px 16px!important}}
    @media(min-width:761px){.bmm-theme-options{align-items:stretch}.bmm-theme-option{min-height:122px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
  `;
  document.head.appendChild(bmmThemeStyle);
  const bmmReadableStyle = document.createElement('style');
  bmmReadableStyle.id = 'bmm-readable-contrast-style';
  bmmReadableStyle.textContent = `
/* BMM accessibility refinement: stronger contrast, readable typography and consistent theme surfaces. */
html, html[data-bmm-theme="light"], html[data-bmm-theme="auto"] {
  color-scheme: light;
  --ink: #172d21;
  --muted: #43584a;
  --text-soft: #3e5547;
  --bg: #f3f6f0;
  --paper: #fffefa;
  --surface-elevated: #f7faf5;
  --field-bg: #ffffff;
  --input-border: #b9cbb8;
  --line: #cfdbce;
  --green: #17643f;
  --red: #a12635;
  --red2: #8a1e2c;
  --gold: #9b7926;
  --accent-soft: #e6f0e3;
  --accent-ink: #174f31;
  --section-tint: #edf3e7;
}
html[data-bmm-theme="dark"] {
  color-scheme: dark;
  --ink: #f1f7f2;
  --muted: #c2d2c7;
  --text-soft: #cad8ce;
  --bg: #0b1711;
  --paper: #14251b;
  --surface-elevated: #1a3022;
  --field-bg: #0f2117;
  --input-border: #55725f;
  --line: #3b5746;
  --green: #8dd9a9;
  --red: #ffb7bb;
  --red2: #ffd0d3;
  --gold: #e5cd79;
  --accent-soft: #234331;
  --accent-ink: #c6f0cf;
  --section-tint: #1b3424;
}
@media (prefers-color-scheme: dark) {
  html[data-bmm-theme="auto"] {
    color-scheme: dark;
    --ink: #f1f7f2;
    --muted: #c2d2c7;
    --text-soft: #cad8ce;
    --bg: #0b1711;
    --paper: #14251b;
    --surface-elevated: #1a3022;
    --field-bg: #0f2117;
    --input-border: #55725f;
    --line: #3b5746;
    --green: #8dd9a9;
    --red: #ffb7bb;
    --red2: #ffd0d3;
    --gold: #e5cd79;
    --accent-soft: #234331;
    --accent-ink: #c6f0cf;
    --section-tint: #1b3424;
  }
}
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body, button, input, select, textarea {
  font-family: Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, ui-sans-serif, system-ui, sans-serif !important;
  font-synthesis: none;
}
body { font-size: 15.5px !important; line-height: 1.55 !important; color: var(--ink) !important; }
button, input, select, textarea { font-size: inherit; }
body, .main, .content, .page-content { color: var(--ink); }
.content { font-size: 15px; }
.content h1, .content h2, .content h3, .content h4,
.page-head h1, .page-head h2, .pro-card-head h2, .card-head h2,
.pro-card h2, .card h2, .member-heading h3, .group-tile h3,
.event-card h3, .modal h2, .modal h3, .bmm-theme-settings h2 {
  color: var(--ink) !important;
  text-wrap: pretty;
}
.content p, .content .muted, .content .subtitle, .content .sub,
.content .section-filter-note, .content .pro-card-head p,
.content .pro-kpi-label, .content .pro-kpi-meta,
.content .member-heading p, .content .member-meta,
.content .member-fact span, .content .bar-label, .content .bar-value,
.content .event-notes, .content .timeline-meta, .content .field-hint,
.content .help-text, .content .cloud-state, .content .topbar-kicker,
.content .report-preview-note, .content .filter-description,
.content .chart-legend, .content .chart-caption {
  color: var(--muted) !important;
}
.content .page-head p { color: var(--text-soft) !important; font-size: 14.5px !important; line-height: 1.6 !important; }
.content .pro-card-head p, .content .card-head p { font-size: 13.5px !important; line-height: 1.55 !important; }
.content label, .content .field label, .content .filter-panel label,
.content .global-filterbar label { color: var(--text-soft) !important; font-size: 13px !important; font-weight: 650 !important; line-height: 1.4 !important; }
.content input, .content select, .content textarea,
.global-filterbar input, .global-filterbar select,
.filter-panel input, .filter-panel select, .filter-panel textarea {
  color: var(--ink) !important;
  background-color: var(--field-bg) !important;
  border-color: var(--input-border) !important;
  font-size: 14.5px !important;
  line-height: 1.4 !important;
}
input::placeholder, textarea::placeholder, .content input::placeholder,
.content textarea::placeholder { color: var(--muted) !important; opacity: .88 !important; }
select option { background: var(--paper); color: var(--ink); }
.content input:focus, .content select:focus, .content textarea:focus {
  border-color: var(--green) !important; outline: 3px solid color-mix(in srgb, var(--green) 25%, transparent) !important; outline-offset: 1px;
}
.card, .pro-card, .stat-card, .pro-kpi, .filter-panel, .global-filterbar,
.event-card, .group-tile, .member-card, .member-empty, .chart-card,
.timeline-item, .report-preview-shell, .modal, .modal-content,
.bmm-theme-option, .settings-card, .config-card {
  color: var(--ink) !important;
  border-color: var(--line) !important;
}
.card, .pro-card, .stat-card, .pro-kpi, .filter-panel, .global-filterbar,
.member-card, .member-empty, .chart-card, .timeline-item, .settings-card, .config-card {
  background: linear-gradient(145deg, var(--paper), var(--surface-elevated)) !important;
}
.pro-card-head, .card-head { border-color: var(--line) !important; }
.pro-kpi { box-shadow: 0 8px 24px rgba(8, 35, 20, .07); }
.pro-kpi .pro-kpi-label { font-size: 12px !important; font-weight: 700 !important; line-height: 1.4 !important; }
.pro-kpi .pro-kpi-value { color: var(--ink) !important; font-size: clamp(23px, 2.4vw, 32px) !important; font-weight: 800 !important; letter-spacing: -.35px; line-height: 1.15 !important; }
.pro-kpi .pro-kpi-meta { font-size: 11.5px !important; line-height: 1.45 !important; }
.stat-card .stat-top { color: var(--muted) !important; font-size: 12px !important; font-weight: 700 !important; }
.stat-card .stat-value { color: var(--ink) !important; font-weight: 800 !important; }
.btn-soft, .icon-btn, .bmm-theme-option, .bmm-more-close {
  background: var(--surface-elevated) !important; color: var(--ink) !important; border-color: var(--line) !important;
}
.pill, .audit-badge, .member-instrument-chip, .event-datebox {
  background: var(--accent-soft) !important; color: var(--accent-ink) !important; border-color: var(--line) !important; font-weight: 700 !important;
}
.member-status { background: var(--accent-soft) !important; color: var(--accent-ink) !important; font-size: 11px !important; }
.member-status.inactive { background: color-mix(in srgb, var(--gold) 20%, var(--paper)) !important; color: var(--ink) !important; }
.member-heading p, .member-meta, .member-fact span { font-size: 12px !important; line-height: 1.45 !important; }
.member-fact strong { color: var(--green) !important; font-size: 15px !important; }
.data-table, .audit-table { color: var(--ink) !important; font-size: 13.5px !important; }
.data-table th, .audit-table th { background: var(--surface-elevated) !important; color: var(--text-soft) !important; border-color: var(--line) !important; font-weight: 750 !important; font-size: 12px !important; }
.data-table td, .audit-table td { color: var(--ink) !important; border-color: var(--line) !important; }
.data-table tr:nth-child(even), .audit-table tr:nth-child(even) { background: color-mix(in srgb, var(--surface-elevated) 75%, var(--paper)) !important; }
.table-wrap, .table-scroll { border-color: var(--line) !important; }
.chart-wrap svg text, .chart-container svg text, .chart-area svg text,
.chart-svg text, .pro-chart svg text, .bar-chart svg text,
.recharts-cartesian-axis-tick-value, .recharts-legend-item-text {
  fill: var(--muted) !important; color: var(--muted) !important; font-size: 12px !important;
}
.topbar { color: var(--ink) !important; border-bottom-color: var(--line) !important; }
.topbar .top-title, .topbar .topbar-ident h1, .topbar .topbar-ident h2 { color: var(--ink) !important; }
.topbar .topbar-kicker, .topbar .crumb { color: var(--muted) !important; }
.toast, .login-error, .error-text { font-weight: 650; }
.login-card { background: var(--paper) !important; color: var(--ink) !important; border-color: var(--line) !important; }
.login-card h2, .login-card label { color: var(--ink) !important; }
.login-card p { color: var(--muted) !important; }
.login-card input[type=password] { background: var(--field-bg) !important; color: var(--ink) !important; border-color: var(--input-border) !important; }
.login-error { color: #b42335 !important; }
html[data-bmm-theme="dark"] .login-card .login-error { color: #ffb7c0 !important; }
html[data-bmm-theme="dark"] body,
html[data-bmm-theme="dark"] .main,
html[data-bmm-theme="dark"] .content,
html[data-bmm-theme="dark"] .page-content { background-color: var(--bg) !important; color: var(--ink) !important; }
html[data-bmm-theme="dark"] .topbar {
  background-color: #11251a !important;
  background-image: linear-gradient(90deg,rgba(12,31,21,.98) 0%,rgba(12,31,21,.94) 58%,rgba(12,31,21,.84) 100%),url('assets/bmm-header-banner.webp') !important;
  border-bottom-color: var(--line) !important;
}
html[data-bmm-theme="dark"] .topbar:after { opacity: .08 !important; }
html[data-bmm-theme="dark"] .pro-card-head, html[data-bmm-theme="dark"] .card-head { background: transparent !important; }
html[data-bmm-theme="dark"] .event-card-head, html[data-bmm-theme="dark"] .group-tile,
html[data-bmm-theme="dark"] .member-fact, html[data-bmm-theme="dark"] .member-avatar,
html[data-bmm-theme="dark"] .member-empty {
  background: linear-gradient(140deg, var(--paper), var(--surface-elevated)) !important;
  color: var(--ink) !important; border-color: var(--line) !important;
}
html[data-bmm-theme="dark"] .member-avatar { color: var(--green) !important; }
html[data-bmm-theme="dark"] .nav button { color: #d4e3d8 !important; }
html[data-bmm-theme="dark"] .nav button.active { color: #fffdf4 !important; }
html[data-bmm-theme="dark"] .login-shell, html[data-bmm-theme="dark"] .login-card-wrap { background: #09160f !important; }
html[data-bmm-theme="dark"] .btn-soft:hover, html[data-bmm-theme="dark"] .icon-btn:hover { background: #294532 !important; }
@media (prefers-color-scheme: dark) {
  html[data-bmm-theme="auto"] body,
  html[data-bmm-theme="auto"] .main,
  html[data-bmm-theme="auto"] .content,
  html[data-bmm-theme="auto"] .page-content { background-color: var(--bg) !important; color: var(--ink) !important; }
  html[data-bmm-theme="auto"] .topbar {
    background-color: #11251a !important;
    background-image: linear-gradient(90deg,rgba(12,31,21,.98) 0%,rgba(12,31,21,.94) 58%,rgba(12,31,21,.84) 100%),url('assets/bmm-header-banner.webp') !important;
    border-bottom-color: var(--line) !important;
  }
  html[data-bmm-theme="auto"] .topbar:after { opacity: .08 !important; }
  html[data-bmm-theme="auto"] .pro-card-head, html[data-bmm-theme="auto"] .card-head { background: transparent !important; }
  html[data-bmm-theme="auto"] .event-card-head, html[data-bmm-theme="auto"] .group-tile,
  html[data-bmm-theme="auto"] .member-fact, html[data-bmm-theme="auto"] .member-avatar,
  html[data-bmm-theme="auto"] .member-empty {
    background: linear-gradient(140deg, var(--paper), var(--surface-elevated)) !important;
    color: var(--ink) !important; border-color: var(--line) !important;
  }
  html[data-bmm-theme="auto"] .nav button { color: #d4e3d8 !important; }
  html[data-bmm-theme="auto"] .nav button.active { color: #fffdf4 !important; }
  html[data-bmm-theme="auto"] .login-shell, html[data-bmm-theme="auto"] .login-card-wrap { background: #09160f !important; }
}
@media (max-width: 760px) {
  body { font-size: 14.5px !important; line-height: 1.5 !important; }
  .content { font-size: 14.5px !important; }
  .content .page-head p { font-size: 13.5px !important; }
  .content .pro-card-head h2, .content .card-head h2 { font-size: 16px !important; line-height: 1.3 !important; }
  .content .pro-card-head p, .content .card-head p { font-size: 12.5px !important; }
  .content label, .content .field label, .filter-panel label, .global-filterbar label { font-size: 12px !important; }
  .content input, .content select, .content textarea, .filter-panel input, .filter-panel select { font-size: 14px !important; }
  .pro-kpi .pro-kpi-label { font-size: 11px !important; }
  .pro-kpi .pro-kpi-meta { font-size: 10.5px !important; }
  .bar-label, .bar-value { font-size: 11px !important; }
  .data-table, .audit-table { font-size: 12.5px !important; }
  .data-table th, .audit-table th { font-size: 11.5px !important; }
}
@media (prefers-reduced-motion: reduce) {
  body, .card, .pro-card, .btn, .stat-card, .pro-kpi, input, select, textarea { transition: none !important; animation: none !important; }
}
`;
  document.head.appendChild(bmmReadableStyle);
  bmmApplyTheme();
  const bmmContrastRepairStyle=document.createElement('style');bmmContrastRepairStyle.id='bmm-contrast-repair-v2';bmmContrastRepairStyle.textContent=`/* BMM visual repair v2: avoid washed-out text on dark surfaces and pale text on ivory cards. */
html, html[data-bmm-theme="light"], html[data-bmm-theme="auto"] {
  --bmm-text-main:#20392b; --bmm-text-muted:#455c4d; --bmm-text-soft:#52695b;
  --bmm-card:#fffefa; --bmm-card-alt:#f1f5ed; --bmm-card-line:#d4dfd2;
  --bmm-nav-title:#17382a; --bmm-nav-meta:#526b5b;
}
html[data-bmm-theme="dark"] {
  --bmm-text-main:#f4f8f4; --bmm-text-muted:#d0ded3; --bmm-text-soft:#bdcec2;
  --bmm-card:#14271b; --bmm-card-alt:#1a3324; --bmm-card-line:#3a5744;
  --bmm-nav-title:#f4f8f4; --bmm-nav-meta:#c6d8cb;
}
html, body { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
body, .main, .content, .page-content { color:var(--bmm-text-main) !important; }
/* Keep the top bar's title legible over the decorative banner. */
html[data-bmm-theme="light"] .topbar,
html[data-bmm-theme="auto"] .topbar {
  background-color:#fffefa !important;
  background-image:linear-gradient(90deg,rgba(255,254,250,.99) 0%,rgba(255,254,250,.97) 63%,rgba(255,254,250,.80) 100%),url('assets/bmm-header-banner.webp') !important;
  background-position:center,right 48% !important; background-size:cover !important;
}
html[data-bmm-theme="light"] .topbar .top-title,
html[data-bmm-theme="light"] .topbar #topTitle,
html[data-bmm-theme="light"] .topbar .crumb,
html[data-bmm-theme="light"] .topbar .mobile-brand,
html[data-bmm-theme="light"] .topbar .date-today,
html[data-bmm-theme="auto"] .topbar .top-title,
html[data-bmm-theme="auto"] .topbar #topTitle,
html[data-bmm-theme="auto"] .topbar .crumb,
html[data-bmm-theme="auto"] .topbar .mobile-brand,
html[data-bmm-theme="auto"] .topbar .date-today {
  color:var(--bmm-nav-title) !important; opacity:1 !important; text-shadow:none !important;
}
html[data-bmm-theme="light"] .topbar .crumb, html[data-bmm-theme="auto"] .topbar .crumb { color:var(--bmm-nav-meta) !important; }
/* The insight tiles and quick actions had hard-coded pale surfaces. Match them to the active theme. */
html[data-bmm-theme="light"] .insight-row, html[data-bmm-theme="auto"] .insight-row {
  background:#fffefa !important; border:1px solid #d8e2d5 !important; color:#20392b !important;
}
html[data-bmm-theme="light"] .insight-row strong, html[data-bmm-theme="auto"] .insight-row strong,
html[data-bmm-theme="light"] .quick-action strong, html[data-bmm-theme="auto"] .quick-action strong {
  color:#20392b !important; opacity:1 !important; font-weight:750 !important;
}
html[data-bmm-theme="light"] .insight-row span, html[data-bmm-theme="auto"] .insight-row span,
html[data-bmm-theme="light"] .quick-action span, html[data-bmm-theme="auto"] .quick-action span {
  color:#455c4d !important; opacity:1 !important;
}
html[data-bmm-theme="light"] .quick-action, html[data-bmm-theme="auto"] .quick-action {
  background:#fffefa !important; border:1px solid #d8e2d5 !important; color:#20392b !important;
}
html[data-bmm-theme="light"] .insight-icon, html[data-bmm-theme="auto"] .insight-icon,
html[data-bmm-theme="light"] .quick-action .qa-icon, html[data-bmm-theme="auto"] .quick-action .qa-icon {
  background:#e7f0e3 !important; color:#205d3a !important;
}
html[data-bmm-theme="dark"] body,
html[data-bmm-theme="dark"] .main,
html[data-bmm-theme="dark"] .content,
html[data-bmm-theme="dark"] .page-content { background-color:#091710 !important; color:#f4f8f4 !important; }
html[data-bmm-theme="dark"] .topbar {
  background-color:#0e2418 !important;
  background-image:linear-gradient(90deg,rgba(10,31,20,.99) 0%,rgba(10,31,20,.96) 64%,rgba(10,31,20,.88) 100%),url('assets/bmm-header-banner.webp') !important;
  background-position:center,right 48% !important; background-size:cover !important;
  border-bottom-color:#3a5744 !important;
}
html[data-bmm-theme="dark"] .topbar .top-title,
html[data-bmm-theme="dark"] .topbar #topTitle,
html[data-bmm-theme="dark"] .topbar h1,
html[data-bmm-theme="dark"] .topbar h2 { color:#f6faf6 !important; opacity:1 !important; text-shadow:0 1px 4px rgba(0,0,0,.35) !important; font-weight:800 !important; }
html[data-bmm-theme="dark"] .topbar .crumb,
html[data-bmm-theme="dark"] .topbar .mobile-brand,
html[data-bmm-theme="dark"] .topbar .date-today { color:#d0e0d4 !important; opacity:1 !important; }
html[data-bmm-theme="dark"] .pro-card,
html[data-bmm-theme="dark"] .card,
html[data-bmm-theme="dark"] .stat-card,
html[data-bmm-theme="dark"] .pro-kpi,
html[data-bmm-theme="dark"] .filter-panel,
html[data-bmm-theme="dark"] .global-filterbar,
html[data-bmm-theme="dark"] .chart-card,
html[data-bmm-theme="dark"] .setting-card,
html[data-bmm-theme="dark"] .config-card,
html[data-bmm-theme="dark"] .timeline-card,
html[data-bmm-theme="dark"] .group-card {
  color:#f2f7f3 !important; border-color:#355441 !important;
}
html[data-bmm-theme="dark"] .pro-card-head h2,
html[data-bmm-theme="dark"] .card-head h2,
html[data-bmm-theme="dark"] .pro-card h1,
html[data-bmm-theme="dark"] .pro-card h2,
html[data-bmm-theme="dark"] .pro-card h3 { color:#f4f8f4 !important; }
html[data-bmm-theme="dark"] .pro-card-head p,
html[data-bmm-theme="dark"] .card-head p,
html[data-bmm-theme="dark"] .content p,
html[data-bmm-theme="dark"] .content .muted,
html[data-bmm-theme="dark"] .content .subtitle,
html[data-bmm-theme="dark"] .content .sub,
html[data-bmm-theme="dark"] .content .footnote,
html[data-bmm-theme="dark"] .content .field-hint,
html[data-bmm-theme="dark"] .content .help-text,
html[data-bmm-theme="dark"] .content .chart-caption,
html[data-bmm-theme="dark"] .content .report-preview-note { color:#c9d9ce !important; opacity:1 !important; }
html[data-bmm-theme="dark"] .insight-row,
html[data-bmm-theme="dark"] .quick-action {
  background:linear-gradient(145deg,#1a3323,#14281c) !important;
  border:1px solid #3b5845 !important; color:#f4f8f4 !important;
  box-shadow:0 8px 20px rgba(0,0,0,.13) !important;
}
html[data-bmm-theme="dark"] .insight-row strong,
html[data-bmm-theme="dark"] .quick-action strong { color:#f4f8f4 !important; opacity:1 !important; font-weight:750 !important; }
html[data-bmm-theme="dark"] .insight-row span,
html[data-bmm-theme="dark"] .quick-action span { color:#ccdbd0 !important; opacity:1 !important; }
html[data-bmm-theme="dark"] .insight-icon,
html[data-bmm-theme="dark"] .quick-action .qa-icon {
  background:#284934 !important; color:#c2f1ca !important; border:1px solid #41694d !important;
}
html[data-bmm-theme="dark"] .pill,
html[data-bmm-theme="dark"] .audit-badge,
html[data-bmm-theme="dark"] .member-instrument-chip { background:#234331 !important; color:#e1f4e5 !important; border-color:#41654b !important; }
html[data-bmm-theme="dark"] .chart-empty,
html[data-bmm-theme="dark"] .empty-state,
html[data-bmm-theme="dark"] .empty-state-card { background:#14271b !important; color:#cbdacf !important; border-color:#3a5744 !important; }
html[data-bmm-theme="dark"] .pro-card-head, html[data-bmm-theme="dark"] .card-head { border-bottom-color:#355441 !important; }
html[data-bmm-theme="dark"] .btn-soft, html[data-bmm-theme="dark"] .icon-btn { background:#1a3323 !important; color:#edf6ef !important; border-color:#486551 !important; }
html[data-bmm-theme="dark"] .content label, html[data-bmm-theme="dark"] .field label,
html[data-bmm-theme="dark"] .filter-panel label { color:#d1e0d5 !important; }
html[data-bmm-theme="dark"] input::placeholder, html[data-bmm-theme="dark"] textarea::placeholder { color:#afc4b5 !important; opacity:1 !important; }
@media (prefers-color-scheme: dark) {
  html[data-bmm-theme="auto"] body,
  html[data-bmm-theme="auto"] .main,
  html[data-bmm-theme="auto"] .content,
  html[data-bmm-theme="auto"] .page-content { background-color:#091710 !important; color:#f4f8f4 !important; }
  html[data-bmm-theme="auto"] .topbar {
    background-color:#0e2418 !important;
    background-image:linear-gradient(90deg,rgba(10,31,20,.99) 0%,rgba(10,31,20,.96) 64%,rgba(10,31,20,.88) 100%),url('assets/bmm-header-banner.webp') !important;
    border-bottom-color:#3a5744 !important;
  }
  html[data-bmm-theme="auto"] .topbar .top-title,
  html[data-bmm-theme="auto"] .topbar #topTitle,
  html[data-bmm-theme="auto"] .topbar h1,
  html[data-bmm-theme="auto"] .topbar h2 { color:#f6faf6 !important; opacity:1 !important; text-shadow:0 1px 4px rgba(0,0,0,.35) !important; font-weight:800 !important; }
  html[data-bmm-theme="auto"] .topbar .crumb,
  html[data-bmm-theme="auto"] .topbar .mobile-brand,
  html[data-bmm-theme="auto"] .topbar .date-today { color:#d0e0d4 !important; opacity:1 !important; }
  html[data-bmm-theme="auto"] .pro-card,
  html[data-bmm-theme="auto"] .card,
  html[data-bmm-theme="auto"] .stat-card,
  html[data-bmm-theme="auto"] .pro-kpi,
  html[data-bmm-theme="auto"] .filter-panel,
  html[data-bmm-theme="auto"] .global-filterbar,
  html[data-bmm-theme="auto"] .chart-card,
  html[data-bmm-theme="auto"] .setting-card,
  html[data-bmm-theme="auto"] .config-card,
  html[data-bmm-theme="auto"] .timeline-card,
  html[data-bmm-theme="auto"] .group-card { color:#f2f7f3 !important; border-color:#355441 !important; }
  html[data-bmm-theme="auto"] .pro-card-head h2,
  html[data-bmm-theme="auto"] .card-head h2,
  html[data-bmm-theme="auto"] .pro-card h1,
  html[data-bmm-theme="auto"] .pro-card h2,
  html[data-bmm-theme="auto"] .pro-card h3 { color:#f4f8f4 !important; }
  html[data-bmm-theme="auto"] .pro-card-head p,
  html[data-bmm-theme="auto"] .card-head p,
  html[data-bmm-theme="auto"] .content p,
  html[data-bmm-theme="auto"] .content .muted,
  html[data-bmm-theme="auto"] .content .subtitle,
  html[data-bmm-theme="auto"] .content .sub,
  html[data-bmm-theme="auto"] .content .footnote,
  html[data-bmm-theme="auto"] .content .field-hint,
  html[data-bmm-theme="auto"] .content .help-text,
  html[data-bmm-theme="auto"] .content .chart-caption,
  html[data-bmm-theme="auto"] .content .report-preview-note { color:#c9d9ce !important; opacity:1 !important; }
  html[data-bmm-theme="auto"] .insight-row,
  html[data-bmm-theme="auto"] .quick-action { background:linear-gradient(145deg,#1a3323,#14281c) !important; border:1px solid #3b5845 !important; color:#f4f8f4 !important; box-shadow:0 8px 20px rgba(0,0,0,.13) !important; }
  html[data-bmm-theme="auto"] .insight-row strong,
  html[data-bmm-theme="auto"] .quick-action strong { color:#f4f8f4 !important; opacity:1 !important; font-weight:750 !important; }
  html[data-bmm-theme="auto"] .insight-row span,
  html[data-bmm-theme="auto"] .quick-action span { color:#ccdbd0 !important; opacity:1 !important; }
  html[data-bmm-theme="auto"] .insight-icon,
  html[data-bmm-theme="auto"] .quick-action .qa-icon { background:#284934 !important; color:#c2f1ca !important; border:1px solid #41694d !important; }
  html[data-bmm-theme="auto"] .pill,
  html[data-bmm-theme="auto"] .audit-badge,
  html[data-bmm-theme="auto"] .member-instrument-chip { background:#234331 !important; color:#e1f4e5 !important; border-color:#41654b !important; }
  html[data-bmm-theme="auto"] .chart-empty,
  html[data-bmm-theme="auto"] .empty-state,
  html[data-bmm-theme="auto"] .empty-state-card { background:#14271b !important; color:#cbdacf !important; border-color:#3a5744 !important; }
  html[data-bmm-theme="auto"] .pro-card-head, html[data-bmm-theme="auto"] .card-head { border-bottom-color:#355441 !important; }
  html[data-bmm-theme="auto"] .btn-soft, html[data-bmm-theme="auto"] .icon-btn { background:#1a3323 !important; color:#edf6ef !important; border-color:#486551 !important; }
  html[data-bmm-theme="auto"] .content label, html[data-bmm-theme="auto"] .field label,
  html[data-bmm-theme="auto"] .filter-panel label { color:#d1e0d5 !important; }
  html[data-bmm-theme="auto"] input::placeholder, html[data-bmm-theme="auto"] textarea::placeholder { color:#afc4b5 !important; opacity:1 !important; }
}
/* Clear, high-contrast text for insight cards on light surfaces. */
html[data-bmm-theme="light"] .insight-row strong, html[data-bmm-theme="auto"] .insight-row strong {color:#20392b!important;}
html[data-bmm-theme="light"] .insight-row span, html[data-bmm-theme="auto"] .insight-row span {color:#455c4d!important;}
`;document.head.appendChild(bmmContrastRepairStyle);

  /* BMM v4: resolved theme, simpler dashboard and compact global filters. */
  const bmmOldApplyThemeV4 = bmmApplyTheme;
  bmmApplyTheme = function(){
    bmmOldApplyThemeV4();
    const resolved = bmmThemeMode === 'dark' || (bmmThemeMode === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    document.documentElement.dataset.bmmResolvedTheme = resolved;
  };
  bmmApplyTheme();

  let bmmGlobalFiltersExpandedV4 = false;
  document.addEventListener('toggle', function(e){
    if(e.target && e.target.id === 'bmmGlobalFilterDisclosureV4') bmmGlobalFiltersExpandedV4 = !!e.target.open;
  }, true);
  const bmmOldGlobalFilterHTMLV4 = bmmGlobalFilterHTML;
  bmmGlobalFilterHTML = function(source=state){
    const raw = bmmOldGlobalFilterHTMLV4(source);
    const start = raw.indexOf('<section class="global-filterbar"');
    const end = raw.indexOf('</section>', start);
    if(start < 0 || end < 0) return raw;
    const section = raw.slice(start, end + '</section>'.length);
    let inner = section.replace(/^<section[^>]*>/, '').replace(/<\/section>$/, '');
    inner = inner.replace(/<div class="global-filter-title">[\s\S]*?<\/div>/, '');
    const note = raw.slice(end + '</section>'.length);
    const active = Object.entries(bmmGlobal).filter(([k,v]) => k === 'q' ? !!String(v||'').trim() : !!v && v !== 'all').length;
    return `<details id="bmmGlobalFilterDisclosureV4" class="bmm-global-filter-disclosure" ${bmmGlobalFiltersExpandedV4?'open':''}>
      <summary><span class="bmm-filter-summary-icon" aria-hidden="true">⌕</span><span class="bmm-filter-summary-copy"><strong>Buscar y filtrar</strong><small>Encuentra actuaciones, marchas y autores</small></span><span class="bmm-filter-count">${active ? active+' activo'+(active===1?'':'s') : 'Todo el registro'}</span><span class="bmm-filter-chevron" aria-hidden="true">⌄</span></summary>
      <div class="bmm-filter-disclosure-body"><div class="global-filterbar bmm-global-filterbar-v4">${inner}</div></div>
    </details>${note}`;
  };

  /* Simplify the landing dashboard: key figures first, details only when requested. */
  renderDashboard = function(){
    const ev = [...state.events].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
    const plays = bmmPerf(ev);
    const countsByMarch = counts(ev);
    const playedDistinct = Object.keys(countsByMarch).length;
    const withoutMarches = ev.filter(e => !(e.marches||[]).length).length;
    const groupsCount = new Set(ev.map(bmmGroup)).size;
    const today = bmmTodayKey();
    const next = ev.filter(e=>(e.date||'')>=today && bmmStatus(e)!=='Cancelado').sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''))[0];
    const past = ev.filter(e=>(e.date||'')<=today).slice(-3).reverse();
    const top = state.repertoire.map(m=>({...m,count:countsByMarch[m.id]||0})).filter(m=>m.count>0).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es')).slice(0,5);
    const groups = Object.entries(bmmCountBy(ev,bmmGroup)).map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count).slice(0,5);
    const monthly = bmmMonths(ev);
    const insights = [];
    if(top[0]) insights.push({icon:'♫',title:'Marcha más interpretada',text:`${top[0].name} · ${top[0].count} interpretaciones registradas.`});
    if(withoutMarches) insights.push({icon:'!',title:'Actuaciones por completar',text:`${withoutMarches} actuación${withoutMarches===1?'':'es'} todavía no tiene marchas anotadas.`});
    if(!insights.length) insights.push({icon:'✓',title:'Registro al día',text:'Los avisos aparecerán aquí cuando haya datos que revisar.'});
    return `${bmmHeader('Resumen','Resumen de la banda','Lo esencial de la actividad musical, sin saturar la pantalla.',`<button class="btn btn-soft" data-action="preview-section-pdf" data-report-type="full">▧ Informe general</button><button class="btn btn-primary" data-action="add-event">＋ Nueva actuación</button>`)}
      <section class="bmm-overview-banner"><div class="bmm-overview-mark" aria-hidden="true">♫</div><div class="bmm-overview-copy"><div class="bmm-overview-kicker">BANDA MUNICIPAL · ARJONILLA</div><h2>La actividad, clara y ordenada.</h2><p>Actuaciones, repertorio y próximos compromisos en un solo lugar.</p></div><div class="bmm-overview-season"><span>Grupos activos</span><strong>${bmmFormatNum(groupsCount)}</strong></div></section>
      <div class="bmm-summary-metrics">
        <article class="bmm-metric-card metric-green"><span class="bmm-metric-icon">◷</span><span class="bmm-metric-label">Actuaciones</span><strong>${bmmFormatNum(ev.length)}</strong><small>En el filtro actual</small></article>
        <article class="bmm-metric-card metric-gold"><span class="bmm-metric-icon">♫</span><span class="bmm-metric-label">Interpretaciones</span><strong>${bmmFormatNum(plays.length)}</strong><small>Marchas anotadas</small></article>
        <article class="bmm-metric-card metric-teal"><span class="bmm-metric-icon">▤</span><span class="bmm-metric-label">Repertorio activo</span><strong>${bmmFormatNum(playedDistinct)}</strong><small>Marchas con historial</small></article>
        <article class="bmm-metric-card metric-purple"><span class="bmm-metric-icon">▦</span><span class="bmm-metric-label">Grupos</span><strong>${bmmFormatNum(groupsCount)}</strong><small>Con actividad registrada</small></article>
      </div>
      <div class="bmm-dashboard-grid">
        <section class="pro-card bmm-dash-card"><div class="pro-card-head"><div><h2>Próxima actuación</h2><p>El siguiente compromiso planificado</p></div><button class="btn btn-soft btn-small" data-page="actuaciones">Ver agenda ↗</button></div><div class="pro-card-body">${next?`${eventPreview(next)}<div class="bmm-inline-meta"><span class="pill gold">${esc(bmmGroup(next))}</span><span class="pill">${(next.marches||[]).length} marchas anotadas</span><button class="btn btn-soft btn-small" data-action="edit-event" data-id="${esc(next.id)}">Editar</button></div>`:'<div class="chart-empty">No hay próximas actuaciones. Puedes registrar una con el botón «Nueva actuación».</div>'}</div></section>
        <section class="pro-card bmm-dash-card"><div class="pro-card-head"><div><h2>Marchas más interpretadas</h2><p>Solo marchas con registros</p></div><button class="btn btn-soft btn-small" data-page="repertorio">Ver repertorio ↗</button></div><div class="pro-card-body">${top.length?bmmBarChart(top.map(m=>({label:m.name,count:m.count}))):'<div class="chart-empty">Aún no hay interpretaciones registradas.</div>'}</div></section>
        <section class="pro-card bmm-dash-card"><div class="pro-card-head"><div><h2>Actividad reciente</h2><p>Últimas actuaciones realizadas</p></div><button class="btn btn-soft btn-small" data-page="cronologia">Ver cronología ↗</button></div><div class="pro-card-body"><div class="event-list">${past.length?past.map(eventPreview).join(''):'<div class="chart-empty">Aún no hay actuaciones anteriores.</div>'}</div></div></section>
        <section class="pro-card bmm-dash-card"><div class="pro-card-head"><div><h2>Hay que revisar</h2><p>Avisos breves sobre el registro</p></div><span class="pill gold">${insights.length}</span></div><div class="pro-card-body">${insights.map(i=>`<div class="insight-row"><div class="insight-icon">${i.icon}</div><div><strong>${esc(i.title)}</strong><span>${esc(i.text)}</span></div></div>`).join('')}</div></section>
      </div>
      <section class="pro-card bmm-quick-actions-card"><div class="pro-card-head"><div><h2>Accesos rápidos</h2><p>Las tres tareas más habituales</p></div></div><div class="pro-card-body"><div class="quick-action-grid"><button class="quick-action" data-action="add-event"><span class="qa-icon">＋</span><span><strong>Nueva actuación</strong><span>Procesión, concierto o evento</span></span></button><button class="quick-action" data-action="add-march"><span class="qa-icon">♫</span><span><strong>Añadir marcha</strong><span>Ampliar el repertorio</span></span></button><button class="quick-action" data-page="informes"><span class="qa-icon">▧</span><span><strong>Preparar informe</strong><span>Elegir datos y exportar</span></span></button></div></div></section>
      <details class="pro-card bmm-more-analytics"><summary><span><strong>Más estadísticas</strong><small>Actividad mensual y distribución por grupos</small></span><span class="bmm-filter-chevron">⌄</span></summary><div class="bmm-more-analytics-grid"><section><h3>Actividad mensual</h3>${bmmMiniChart(monthly)}</section><section><h3>Eventos por grupo</h3>${groups.length?bmmBarChart(groups):'<div class="chart-empty">Aún no hay grupos con actividad.</div>'}</section></div></details>`;
  };

  const bmmAnalyticsPhaseCStyle = document.createElement('style');
  bmmAnalyticsPhaseCStyle.id = 'bmm-analytics-phase-c';
  bmmAnalyticsPhaseCStyle.textContent = `.bmm-analytics-definition-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.bmm-analytics-definition-grid>div{border:1px solid var(--bmm-border,#d4dfd2);background:var(--bmm-raised,#f3f7f0);border-radius:11px;padding:12px;min-width:0}.bmm-analytics-definition-grid strong{display:block;margin-bottom:5px;color:var(--bmm-text,var(--ink));font-size:12px}.bmm-analytics-definition-grid span{display:block;color:var(--bmm-muted,var(--muted));font-size:11px;line-height:1.5}@media(max-width:600px){.bmm-analytics-definition-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(bmmAnalyticsPhaseCStyle);

  const bmmPolishStyleV4 = document.createElement('style');
  bmmPolishStyleV4.id = 'bmm-polish-style-v4';
  bmmPolishStyleV4.textContent = `
    /* Accurate resolved theme: in dark mode every legacy insight tile uses a dark surface, not ivory. */
    html[data-bmm-resolved-theme="light"]{color-scheme:light;--ink:#17372a;--muted:#43594b;--bg:#f3f6f0;--paper:#fffefa;--line:#d4dfd2;--green:#17643f;--gold:#9b7926;--section-tint:#edf3e7;--bmm-surface:#fffefa;--bmm-raised:#f3f7f0;--bmm-text:#17372a;--bmm-muted:#43594b;--bmm-border:#d4dfd2}
    html[data-bmm-resolved-theme="dark"]{color-scheme:dark;--ink:#f4f8f5;--muted:#c6d5cb;--bg:#091710;--paper:#14271b;--line:#385542;--green:#9be2b1;--gold:#e5cd79;--section-tint:#1a3324;--bmm-surface:#14271b;--bmm-raised:#1a3324;--bmm-text:#f4f8f5;--bmm-muted:#c6d5cb;--bmm-border:#385542}
    html[data-bmm-resolved-theme] body{background:var(--bg)!important;color:var(--bmm-text)!important;font-family:Inter,"Segoe UI",Roboto,Arial,system-ui,sans-serif!important;font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
    html[data-bmm-resolved-theme] .topbar{background-color:var(--bmm-surface)!important;background-image:linear-gradient(90deg,color-mix(in srgb,var(--bmm-surface) 98%,transparent),color-mix(in srgb,var(--bmm-surface) 88%,transparent)),url('assets/bmm-header-banner.webp')!important;background-position:center,right 48%!important;background-size:cover!important;border-bottom:1px solid var(--bmm-border)!important}
    html[data-bmm-resolved-theme="light"] .topbar .top-title,html[data-bmm-resolved-theme="light"] .topbar h1,html[data-bmm-resolved-theme="light"] .topbar h2,html[data-bmm-resolved-theme="light"] .topbar .crumb,html[data-bmm-resolved-theme="light"] .topbar .date-today{color:#17372a!important;opacity:1!important;text-shadow:none!important}
    html[data-bmm-resolved-theme="dark"] .topbar .top-title,html[data-bmm-resolved-theme="dark"] .topbar h1,html[data-bmm-resolved-theme="dark"] .topbar h2{color:#f7faf7!important;opacity:1!important;text-shadow:0 1px 3px #0008!important;font-weight:800!important}
    html[data-bmm-resolved-theme="dark"] .topbar .crumb,html[data-bmm-resolved-theme="dark"] .topbar .date-today{color:#c9d9ce!important;opacity:1!important}
    html[data-bmm-resolved-theme="light"] .topbar .crumb,html[data-bmm-resolved-theme="light"] .topbar .date-today{color:#4e6556!important}
    html[data-bmm-resolved-theme] .content,html[data-bmm-resolved-theme] .main{color:var(--bmm-text)!important;background-color:var(--bg)!important}
    html[data-bmm-resolved-theme] .content h1,html[data-bmm-resolved-theme] .content h2,html[data-bmm-resolved-theme] .content h3,html[data-bmm-resolved-theme] .content h4,html[data-bmm-resolved-theme] .page-head h1,html[data-bmm-resolved-theme] .page-head h2,html[data-bmm-resolved-theme] .pro-card h1,html[data-bmm-resolved-theme] .pro-card h2,html[data-bmm-resolved-theme] .pro-card h3,html[data-bmm-resolved-theme] .card h1,html[data-bmm-resolved-theme] .card h2,html[data-bmm-resolved-theme] .card h3{color:var(--bmm-text)!important;opacity:1!important}
    html[data-bmm-resolved-theme] .content p,html[data-bmm-resolved-theme] .content small,html[data-bmm-resolved-theme] .content .muted,html[data-bmm-resolved-theme] .content .subtitle,html[data-bmm-resolved-theme] .content .sub,html[data-bmm-resolved-theme] .content .card-sub,html[data-bmm-resolved-theme] .content .footnote,html[data-bmm-resolved-theme] .content .section-filter-note,html[data-bmm-resolved-theme] .content .pro-kpi-label,html[data-bmm-resolved-theme] .content .pro-kpi-meta,html[data-bmm-resolved-theme] .content .field-hint,html[data-bmm-resolved-theme] .content .help-text,html[data-bmm-resolved-theme] .content .chart-caption,html[data-bmm-resolved-theme] .content .timeline-meta,html[data-bmm-resolved-theme] .content .report-preview-note{color:var(--bmm-muted)!important;opacity:1!important}
    html[data-bmm-resolved-theme] .card,html[data-bmm-resolved-theme] .pro-card,html[data-bmm-resolved-theme] .stat-card,html[data-bmm-resolved-theme] .pro-kpi,html[data-bmm-resolved-theme] .filter-panel,html[data-bmm-resolved-theme] .global-filterbar,html[data-bmm-resolved-theme] .setting-card,html[data-bmm-resolved-theme] .table-card,html[data-bmm-resolved-theme] .report-event,html[data-bmm-resolved-theme] .member-card,html[data-bmm-resolved-theme] .member-empty,html[data-bmm-resolved-theme] .member-fact,html[data-bmm-resolved-theme] .report-preview,html[data-bmm-resolved-theme] .group-card,html[data-bmm-resolved-theme] .timeline-card,html[data-bmm-resolved-theme] .chart-card,html[data-bmm-resolved-theme] .config-card{background:linear-gradient(145deg,var(--bmm-surface),var(--bmm-raised))!important;color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] .insight-row,html[data-bmm-resolved-theme] .quick-action{background:var(--bmm-raised)!important;color:var(--bmm-text)!important;border:1px solid var(--bmm-border)!important;border-radius:13px!important;box-shadow:0 4px 12px #00000008!important}
    html[data-bmm-resolved-theme] .insight-row strong,html[data-bmm-resolved-theme] .quick-action strong{color:var(--bmm-text)!important;font-weight:750!important;opacity:1!important}
    html[data-bmm-resolved-theme] .insight-row span,html[data-bmm-resolved-theme] .quick-action span:not(.qa-icon){color:var(--bmm-muted)!important;opacity:1!important}
    html[data-bmm-resolved-theme] .insight-icon,html[data-bmm-resolved-theme] .quick-action .qa-icon{background:color-mix(in srgb,var(--green) 15%,var(--bmm-surface))!important;color:var(--green)!important;border:1px solid var(--bmm-border)!important}
    html[data-bmm-resolved-theme] input:not([type=checkbox]):not([type=radio]),html[data-bmm-resolved-theme] select,html[data-bmm-resolved-theme] textarea{background:var(--bmm-surface)!important;color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] input::placeholder,html[data-bmm-resolved-theme] textarea::placeholder{color:var(--bmm-muted)!important;opacity:1!important}
    html[data-bmm-resolved-theme] .content label,html[data-bmm-resolved-theme] .field label,html[data-bmm-resolved-theme] .filter-panel label,html[data-bmm-resolved-theme] .global-filterbar label{color:var(--bmm-muted)!important;font-weight:700!important}
    html[data-bmm-resolved-theme] .btn-soft,html[data-bmm-resolved-theme] .icon-btn{background:var(--bmm-raised)!important;color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] .data-table th,html[data-bmm-resolved-theme] .audit-table th{background:var(--bmm-raised)!important;color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] .data-table td,html[data-bmm-resolved-theme] .audit-table td{color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] .data-table tr:nth-child(even),html[data-bmm-resolved-theme] .audit-table tr:nth-child(even){background:color-mix(in srgb,var(--bmm-raised) 80%,var(--bmm-surface))!important}
    html[data-bmm-resolved-theme] .event-card-head,html[data-bmm-resolved-theme] .event-accordion>summary,html[data-bmm-resolved-theme] .group-accordion>summary,html[data-bmm-resolved-theme] .year-accordion>summary{background:var(--bmm-raised)!important;color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] .chart-empty,html[data-bmm-resolved-theme] .empty-state,html[data-bmm-resolved-theme] .empty-state-card{background:var(--bmm-raised)!important;color:var(--bmm-muted)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] .pill,html[data-bmm-resolved-theme] .audit-badge,html[data-bmm-resolved-theme] .member-instrument-chip{background:color-mix(in srgb,var(--green) 15%,var(--bmm-surface))!important;color:var(--bmm-text)!important;border-color:var(--bmm-border)!important}
    html[data-bmm-resolved-theme] .empty strong{color:var(--bmm-text)!important}
    html[data-bmm-resolved-theme] .chart-wrap svg text,html[data-bmm-resolved-theme] .chart-container svg text,html[data-bmm-resolved-theme] .chart-area svg text,html[data-bmm-resolved-theme] .chart-svg text,html[data-bmm-resolved-theme] .pro-chart svg text,html[data-bmm-resolved-theme] .bar-chart svg text{fill:var(--bmm-muted)!important;color:var(--bmm-muted)!important}
    html[data-bmm-resolved-theme="dark"] .login-shell,html[data-bmm-resolved-theme="dark"] .login-card-wrap{background:#091710!important}
    html[data-bmm-resolved-theme="dark"] .login-card{background:#14271b!important;color:#f4f8f5!important;border-color:#385542!important}
    html[data-bmm-resolved-theme="dark"] .login-card h2,html[data-bmm-resolved-theme="dark"] .login-card p,html[data-bmm-resolved-theme="dark"] .login-card label{color:#f4f8f5!important}
    html[data-bmm-resolved-theme="dark"] .login-card input{background:#0e2016!important;color:#f4f8f5!important;border-color:#496853!important}
    html[data-bmm-resolved-theme="light"] .login-card h2,html[data-bmm-resolved-theme="light"] .login-card label{color:#17372a!important}
    html[data-bmm-resolved-theme="light"] .login-card p{color:#43594b!important}
    /* Calm visual hierarchy and reduce initial information overload. */
    .content{max-width:1370px!important;padding:clamp(16px,2vw,26px) clamp(13px,2.4vw,30px) 85px!important}
    .page-head{gap:14px!important;margin-bottom:16px!important;padding:clamp(12px,1.6vw,20px)!important}
    .page-head h1{font-size:clamp(23px,2.8vw,32px)!important;line-height:1.16!important;margin-bottom:6px!important}
    .page-head p{font-size:13px!important;line-height:1.45!important;max-width:60ch}
    .pro-card-head,.card-head{padding:15px 17px 11px!important}.pro-card-head h2,.card-head h2{font-size:15px!important;line-height:1.3!important}
    .pro-card-head p,.card-head p,.card-sub{font-size:12px!important;line-height:1.45!important}.pro-card-body,.card-body{padding:13px 17px 17px!important}.pro-grid{gap:12px!important}
    .insight-row{padding:11px!important;margin-bottom:7px!important;gap:10px!important}.insight-row strong,.quick-action strong{font-size:13px!important}.insight-row span,.quick-action span:not(.qa-icon){font-size:12px!important;line-height:1.45!important}
    .bmm-global-filter-disclosure{margin:0 0 12px;border:1px solid var(--bmm-border);border-radius:15px;background:var(--bmm-surface);color:var(--bmm-text);overflow:hidden;box-shadow:0 4px 14px #173b2b08}
    .bmm-global-filter-disclosure>summary{list-style:none;display:flex;align-items:center;gap:11px;padding:12px 14px;cursor:pointer;min-height:54px;user-select:none}.bmm-global-filter-disclosure>summary::-webkit-details-marker{display:none}
    .bmm-filter-summary-icon{display:grid;place-items:center;flex:0 0 34px;height:34px;border-radius:10px;background:var(--bmm-raised);color:var(--green);font-size:23px}
    .bmm-filter-summary-copy{display:flex;flex:1;flex-direction:column;gap:1px;min-width:0}.bmm-filter-summary-copy strong{font-size:13px;color:var(--bmm-text)}.bmm-filter-summary-copy small{font-size:11px;color:var(--bmm-muted)}
    .bmm-filter-count{font-size:10px;color:var(--bmm-muted);background:var(--bmm-raised);border:1px solid var(--bmm-border);border-radius:999px;padding:5px 8px;white-space:nowrap}.bmm-filter-chevron{font-size:19px;line-height:1;color:var(--bmm-muted);transition:transform .18s}.bmm-global-filter-disclosure[open] .bmm-filter-chevron,.bmm-more-analytics[open] .bmm-filter-chevron{transform:rotate(180deg)}
    .bmm-global-filter-disclosure[open]>summary,.bmm-more-analytics[open]>summary{border-bottom:1px solid var(--bmm-border)}.bmm-filter-disclosure-body{padding:0}
    .global-filterbar{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important;padding:12px!important;margin:0!important;border-radius:0 0 14px 14px!important;box-shadow:none!important;background:var(--bmm-surface)!important}
    .global-filterbar .global-search{grid-column:1/-1!important;min-width:0!important}.section-filter-note{margin:2px 2px 14px!important;font-size:11px!important;color:var(--bmm-muted)!important}
    .bmm-overview-banner{display:flex;align-items:center;gap:15px;padding:17px 19px;margin:0 0 14px;border:1px solid var(--bmm-border);border-radius:16px;background:linear-gradient(110deg,var(--bmm-surface),var(--bmm-raised));position:relative;overflow:hidden}
    .bmm-overview-banner:after{content:"";position:absolute;right:-45px;top:-90px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--gold) 14%,transparent),transparent 70%);pointer-events:none}
    .bmm-overview-mark{flex:0 0 43px;height:43px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--gold) 20%,var(--bmm-surface));color:var(--gold);font-size:25px;z-index:1}
    .bmm-overview-copy{flex:1;min-width:0;z-index:1}.bmm-overview-kicker{font-size:9px;font-weight:800;letter-spacing:1.3px;color:var(--gold);margin-bottom:4px}.bmm-overview-copy h2{font:700 clamp(17px,2.1vw,23px)/1.2 Georgia,serif;margin:0 0 4px;color:var(--bmm-text)}.bmm-overview-copy p{font-size:12px!important;margin:0;color:var(--bmm-muted)!important;line-height:1.45!important}
    .bmm-overview-season{z-index:1;border-left:1px solid var(--bmm-border);padding-left:17px;min-width:86px;display:flex;flex-direction:column;gap:3px}.bmm-overview-season span{font-size:10px;color:var(--bmm-muted)}.bmm-overview-season strong{font-size:24px;color:var(--bmm-text)}
    .bmm-summary-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:14px}
    .bmm-metric-card{position:relative;min-width:0;display:grid;grid-template-columns:32px minmax(0,1fr);column-gap:9px;align-items:center;padding:13px 14px;border:1px solid var(--bmm-border);border-top:3px solid var(--metric-accent,var(--green));border-radius:14px;background:var(--bmm-surface);box-shadow:0 5px 16px #152f2108}
    .bmm-metric-icon{grid-row:span 3;display:grid;place-items:center;width:31px;height:31px;border-radius:10px;background:var(--bmm-raised);color:var(--metric-accent,var(--green));font-size:17px}
    .bmm-metric-label{font-size:11px;color:var(--bmm-muted);font-weight:700;line-height:1.25}.bmm-metric-card strong{font-size:25px;line-height:1.15;color:var(--bmm-text);font-weight:800;letter-spacing:-.5px;overflow-wrap:anywhere}.bmm-metric-card small{font-size:10px;color:var(--bmm-muted);line-height:1.25}
    .metric-green{--metric-accent:#32915d}.metric-gold{--metric-accent:#b38b2d}.metric-teal{--metric-accent:#36999a}.metric-purple{--metric-accent:#8a75bb}
    html[data-bmm-resolved-theme="dark"] .metric-green{--metric-accent:#8fdbab}html[data-bmm-resolved-theme="dark"] .metric-gold{--metric-accent:#e5cd79}html[data-bmm-resolved-theme="dark"] .metric-teal{--metric-accent:#7cd3cf}html[data-bmm-resolved-theme="dark"] .metric-purple{--metric-accent:#c0b3ff}
    .bmm-dashboard-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;align-items:start}.bmm-inline-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:10px}.bmm-quick-actions-card{margin-top:13px}
    .bmm-quick-actions-card .quick-action-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}.bmm-quick-actions-card .quick-action{min-width:0;padding:12px!important}
    .bmm-more-analytics{margin-top:13px;overflow:hidden}.bmm-more-analytics>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 17px;cursor:pointer}.bmm-more-analytics>summary::-webkit-details-marker{display:none}.bmm-more-analytics>summary strong{display:block;font-size:13px;color:var(--bmm-text)}.bmm-more-analytics>summary small{display:block;color:var(--bmm-muted);font-size:11px;margin-top:3px}.bmm-more-analytics-grid{padding:15px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.bmm-more-analytics-grid section{min-width:0}.bmm-more-analytics-grid h3{font-size:13px;margin:0 0 12px;color:var(--bmm-text)}
    @media(max-width:760px){
      .content{padding:12px 12px calc(84px + env(safe-area-inset-bottom))!important}.page-head{align-items:flex-start!important;flex-direction:column!important;padding:7px 2px 12px!important;border:0!important;background:transparent!important;box-shadow:none!important;margin-bottom:10px!important}.page-head:after{display:none!important}.page-head .toolbar{width:100%;display:flex;gap:7px;flex-wrap:wrap}.page-head .toolbar .btn{flex:1 1 auto;font-size:11px!important;padding:9px 10px!important}.page-head h1{font-size:25px!important;line-height:1.16!important}.page-head p{font-size:12px!important}
      .bmm-overview-banner{padding:13px;gap:10px;margin-bottom:11px;border-radius:14px}.bmm-overview-mark{flex-basis:35px;height:35px;font-size:20px}.bmm-overview-kicker{font-size:8px}.bmm-overview-copy h2{font-size:17px}.bmm-overview-copy p{font-size:11px!important}.bmm-overview-season{padding-left:10px;min-width:61px}.bmm-overview-season span{font-size:9px}.bmm-overview-season strong{font-size:21px}
      .bmm-summary-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:11px}.bmm-metric-card{padding:11px 10px;grid-template-columns:28px minmax(0,1fr);gap:7px}.bmm-metric-icon{width:27px;height:27px;font-size:15px}.bmm-metric-label{font-size:10px}.bmm-metric-card strong{font-size:23px}.bmm-metric-card small{font-size:9px}
      .bmm-dashboard-grid{grid-template-columns:1fr;gap:10px}.pro-card-head,.card-head{padding:12px 13px 9px!important}.pro-card-body,.card-body{padding:11px 13px 13px!important}.pro-card-head h2,.card-head h2{font-size:14px!important}.pro-card-head p,.card-head p{font-size:11px!important}.bmm-inline-meta .btn{margin-left:auto}
      .bmm-quick-actions-card{margin-top:10px}.bmm-quick-actions-card .quick-action-grid{grid-template-columns:1fr!important;gap:7px!important}.bmm-quick-actions-card .quick-action{padding:10px!important;min-height:57px}.bmm-quick-actions-card .qa-icon{width:32px!important;height:32px!important;flex:0 0 32px}
      .bmm-more-analytics-grid{grid-template-columns:1fr;padding:12px;gap:18px}.bmm-global-filter-disclosure{margin-bottom:8px}.bmm-global-filter-disclosure>summary{padding:10px 11px;min-height:49px}.bmm-filter-summary-icon{width:30px;height:30px;flex-basis:30px}.bmm-filter-summary-copy strong{font-size:12px}.bmm-filter-summary-copy small{font-size:10px}.bmm-filter-count{font-size:9px;padding:4px 6px}.global-filterbar{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;padding:10px!important}.global-filterbar .global-search{grid-column:1/-1!important}.global-filterbar .btn{white-space:normal!important;font-size:11px!important;padding:9px!important}.section-filter-note{font-size:10px!important;margin:0 1px 10px!important}
    }
    @media(max-width:370px){.bmm-overview-season{display:none}.bmm-filter-summary-copy small{display:none}.page-head .toolbar .btn{font-size:10px!important}.bmm-metric-card strong{font-size:21px}}
    @media(min-width:761px) and (max-width:1020px){.bmm-summary-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.bmm-dashboard-grid{grid-template-columns:1fr}.bmm-quick-actions-card .quick-action-grid{grid-template-columns:1fr 1fr!important}.global-filterbar{grid-template-columns:repeat(3,minmax(0,1fr))!important}.global-filterbar .global-search{grid-column:1/-1!important}}
    @media(prefers-reduced-motion:reduce){.bmm-metric-card,.pro-card,.quick-action{transition:none!important}}
  `;
  document.head.appendChild(bmmPolishStyleV4);


  // ===== BMM Santa Cecilia · Gestión musical avanzada (base Temas_Auditados) =====
  const BMM_CSV_IMPORT_ACCEPTED = '.csv,.xlsx';
  const BMM_DRAFT_KEY = 'bmm-santa-cecilia-event-draft-v1';
  let bmmRepHistoryFilter='all', bmmDraftTimer=null, bmmPendingCsvRows=null;
  let bmmCloudConflictState=null, bmmForceCloudOverwrite=false;

  function bmmTitleKey(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es')
      .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }
  function bmmDownloadBackup(reason='manual'){
    try{download(`bmm-santa-cecilia-respaldo-${reason}-${bmmTodayKey()}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');return true;}
    catch(err){showToast('No se pudo descargar la copia de seguridad.',true);return false;}
  }
  function bmmStatusPlays(events){return (Array.isArray(events)?events:[]).filter(e=>bmmStatus(e)==='Realizado');}
  const bmmAllPlaysBeforeCompletedOnly=allPlays;
  allPlays=function(events=state.events){return bmmAllPlaysBeforeCompletedOnly(bmmStatusPlays(events));};
  totalPlays=function(events=state.events){return allPlays(events).length;};

  // Repertoire: add real-use state and last performed date, without turning plans into played statistics.
  renderRepertorio=function(){
    const actualPlays=allPlays(state.events), countsById={},lastById=new Map();
    actualPlays.forEach(performance=>{const id=performance.march.id;countsById[id]=(countsById[id]||0)+1;if(!lastById.has(id)||(performance.event.date||'')>(lastById.get(id).date||''))lastById.set(id,performance.event);});
    const styles=[...new Set(state.repertoire.map(m=>m.style).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
    const rows=state.repertoire.filter(m=>{
      const q=repSearch.trim().toLocaleLowerCase('es');const key=bmmTitleKey(m.name+' '+(m.author||'')+' '+(m.style||'')+' '+(m.season||'')+' '+(m.publisher||'')+' '+(m.tags||[]).join(' '));
      const used=(countsById[m.id]||0)>0;
      return (!q||key.includes(bmmTitleKey(q)))&&(repStyle==='all'||m.style===repStyle)&&(bmmRepHistoryFilter==='all'||(bmmRepHistoryFilter==='played'&&used)||(bmmRepHistoryFilter==='never'&&!used));
    }).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    const lastFor=id=>lastById.get(id);
    const never=state.repertoire.filter(m=>!(countsById[m.id]||0)).length;
    return `<div class="page-head"><div><div class="eyebrow">Biblioteca musical</div><h1>Repertorio</h1><p>Catálogo de títulos y autores, con frecuencia basada solo en actuaciones realizadas.</p></div><div class="toolbar"><button class="btn btn-soft" data-action="preview-section-pdf" data-report-type="repertoire">▧ PDF del repertorio</button><button class="btn btn-soft" data-action="export-march-stats-csv">⇩ Frecuencias CSV</button><button class="btn btn-primary" data-action="add-march">＋ Añadir marcha</button></div></div>
      <div class="bmm-catalog-summary"><div><span>Marchas en catálogo</span><strong>${state.repertoire.length}</strong></div><div><span>Con historial real</span><strong>${state.repertoire.length-never}</strong></div><div><span>Sin estrenar / sin registro</span><strong>${never}</strong></div></div>
      <section class="card bmm-catalog-filters"><div class="searchbox"><span>⌕</span><input id="repSearch" value="${esc(repSearch)}" placeholder="Buscar título, autor, temporada o etiqueta…"></div><select class="filter-select" id="repStyle"><option value="all">Todos los estilos</option>${styles.map(st=>`<option value="${esc(st)}" ${repStyle===st?'selected':''}>${esc(st)}</option>`).join('')}</select><select class="filter-select" id="repHistoryFilter"><option value="all" ${bmmRepHistoryFilter==='all'?'selected':''}>Todo el repertorio</option><option value="played" ${bmmRepHistoryFilter==='played'?'selected':''}>Con interpretaciones realizadas</option><option value="never" ${bmmRepHistoryFilter==='never'?'selected':''}>Sin interpretaciones realizadas</option></select><button class="btn btn-soft btn-small" data-action="reset-repertoire-filters">Restablecer filtros</button><span class="pill">${rows.length} resultados</span></section>
      <section class="card table-card bmm-repertoire-table-card"><div class="table-wrap"><table class="data-table bmm-repertoire-table"><thead><tr><th>Marcha</th><th>Autor / compositor</th><th>Veces tocada</th><th>Última interpretación</th><th>Acciones</th></tr></thead><tbody>${rows.map(m=>{const useCount=countsById[m.id]||0;const last=lastFor(m.id);const author=m.author||'Autor pendiente de verificar';const lastLabel=last?`${fmtDate(last.date)} · ${last.name}`:'Sin registro realizado';return `<tr><td><div class="primary-cell">${esc(m.name)}</div>${m.notes?`<div class="secondary-cell bmm-repertoire-note">${esc(m.notes)}</div>`:''}<div class="bmm-repertoire-mobile-meta"><span class="bmm-repertoire-mobile-author">${esc(author)}</span><span class="bmm-repertoire-mobile-last">${last?`Última: ${esc(fmtDate(last.date))} · ${esc(last.name)}`:'Sin interpretación registrada'}</span></div></td><td class="bmm-repertoire-author">${esc(author)}</td><td class="bmm-repertoire-frequency-cell"><span class="bmm-frequency ${useCount?'has-plays':'no-plays'}" aria-label="${useCount} veces tocada">${useCount}</span></td><td class="bmm-repertoire-last">${last?`${fmtDate(last.date)}<div class="secondary-cell">${esc(last.name)}</div>`:'<span class="secondary-cell">Sin registro realizado</span>'}</td><td class="bmm-repertoire-actions-cell"><div class="actions"><button class="icon-btn" data-action="march-insight" data-id="${esc(m.id)}" title="Historial y estadísticas" aria-label="Historial y estadísticas de ${esc(m.name)}">▥</button><button class="icon-btn" data-action="edit-march" data-id="${esc(m.id)}" title="Editar marcha" aria-label="Editar ${esc(m.name)}">✎</button><button class="icon-btn" data-action="delete-march" data-id="${esc(m.id)}" title="Eliminar marcha" aria-label="Eliminar ${esc(m.name)}">⌫</button></div></td></tr>`}).join('')||`<tr><td colspan="5"><div class="empty"><strong>No hay marchas que coincidan</strong><span>Prueba otros filtros o añade una marcha.</span></div></td></tr>`}</tbody></table></div><div class="table-footer"><span>Las actuaciones planificadas no incrementan el recuento de interpretaciones realizadas.</span><span>${rows.length} títulos</span></div></section>`;
  };

  // Make original schedule titles editable while preserving the canonical catalogue name.
  const bmmMarchRowBasePro= marchRowHtml;
  marchRowHtml=function(p={}){
    let html=bmmMarchRowBasePro(p);
    const extra=`<input type="hidden" name="sourceStop" value="${esc(p.sourceStop||p.order||'')}"><div class="field full"><label>Título para el documento (opcional)</label><input name="sourceTitle" maxlength="160" value="${esc(p.sourceTitle||'')}" placeholder="Título exacto del documento, si difiere del catálogo"></div>`;
    return html.replace(/<\/div><\/div>$/,extra+'</div></div>');
  };

  // Event duplicate action reuses date, group, itinerary and marches, but always starts as a plan.
  const bmmEventFormBasePro=eventForm;
  eventForm=function(e){
    const duplicate=!!(e&&e._bmmDuplicate);const original=duplicate?e:null;
    if(duplicate)e={...e,id:'',name:`${e.name||'Actuación'} (copia)`,status:'Planificado',sourceKey:'',_bmmDuplicate:false};
    bmmEventFormBasePro(e);
    const form=document.getElementById('eventForm');if(!form)return;
    const grid=form.querySelector('.form-grid');
    if(grid&&!form.querySelector('[name="reserves"]')){
      grid.insertAdjacentHTML('beforeend',`<div class="field full"><label>Marchas de reserva (separadas por comas)</label><input name="reserves" maxlength="500" value="${esc((e?.reserves||[]).join(', '))}" placeholder="Ej. Soledad Franciscana, Virgen del Valle"></div><div class="field full bmm-confirm-date-field"><label><input name="dateConfirmed" type="checkbox" value="yes" ${e?.dateNeedsConfirmation?'':'checked'}> Fecha confirmada por la banda</label><small>Si la fecha procede de una importación o aún es orientativa, deja la casilla desmarcada.</small></div>`);
    }
    // Lightweight autosaved draft, kept only on this device until the event is saved or dismissed.
    const draftExists=!duplicate&&!e?.id&&(()=>{try{return !!localStorage.getItem(BMM_DRAFT_KEY)}catch(_){return false}})();
    if(draftExists){const box=document.createElement('div');box.className='bmm-draft-notice';box.innerHTML='<span>Hay un borrador de actuación en este dispositivo.</span><div><button type="button" class="btn btn-soft btn-small" data-action="restore-event-draft">Recuperar</button><button type="button" class="btn btn-soft btn-small" data-action="discard-event-draft">Descartar</button></div>';form.insertAdjacentElement('afterbegin',box);}
    const snapshot=()=>{
      const fields={};form.querySelectorAll('[name]').forEach(el=>{if(el.name==='eventId')return;if(el.type==='checkbox')fields[el.name]=el.checked?'yes':'no';else fields[el.name]=el.value;});
      const marches=[...form.querySelectorAll('.march-row')].map(row=>{const out={};row.querySelectorAll('[name]').forEach(el=>{out[el.name]=el.value});return out;});
      const quick=[...form.querySelectorAll('input[name="quickMarchIds"]:checked')].map(x=>x.value);
      try{localStorage.setItem(BMM_DRAFT_KEY,JSON.stringify({savedAt:new Date().toISOString(),fields,marches,quick}))}catch(_){ }
    };
    if(!duplicate&&!e?.id){form.addEventListener('input',()=>{clearTimeout(bmmDraftTimer);bmmDraftTimer=setTimeout(snapshot,450)});form.addEventListener('change',()=>{clearTimeout(bmmDraftTimer);bmmDraftTimer=setTimeout(snapshot,250)});}
    if(duplicate){form.dataset.bmmDuplicate='yes';const title=document.querySelector('#modal .modal-header h2');if(title)title.textContent='Duplicar actuación';const desc=document.querySelector('#modal .modal-header p');if(desc)desc.textContent='Se han copiado los datos y las marchas. Revisa la fecha y confirma el estado antes de guardar.';const submit=document.querySelector('#modal [type="submit"][form="eventForm"]');if(submit)submit.textContent='Guardar copia';}
    form.dataset.bmmDraftEnabled='yes';
  };

  // Historical source-specific importer removed; use the generic CSV/XLSX import instead.

  // Contextual event actions: duplicate a previous service without overwriting its record.
  const bmmEventCardBeforeDuplicate=eventCard;
  eventCard=function(e){let html=bmmEventCardBeforeDuplicate(e);const edit=`<button class="btn btn-soft btn-small" data-action="edit-event" data-id="${esc(e.id)}">✎ Editar</button>`;return html.includes(edit)?html.replace(edit,`<button class="btn btn-soft btn-small" data-action="duplicate-event" data-id="${esc(e.id)}">⧉ Duplicar</button>`+edit):html;};
  const bmmEventPreviewBeforeStatus=eventPreview;
  eventPreview=function(e){let html=bmmEventPreviewBeforeStatus(e);const n=(e.marches||[]).length;const old=`${n} ${n===1?'interpretación':'interpretaciones'}`;const label=bmmStatus(e)==='Realizado'?(n===1?'interpretación':'interpretaciones'):(n===1?'marcha programada':'marchas programadas');return html.replace(old,`${n} ${label}`);};

  // Canonical title duplicates are caught even when accents or punctuation differ.
  const bmmBaseHandleAtEnd=handleAction;
  handleAction=function(el){
    const a=el.dataset.action,id=el.dataset.id;
    if(a==='duplicate-event'){const ev=state.events.find(x=>x.id===id);if(ev)eventForm({...ev,_bmmDuplicate:true});return;}
    if(a==='reset'){
      if(confirm('Esto restaurará el repertorio base y eliminará los registros de este dispositivo. Antes se descargará una copia de seguridad. ¿Continuar?')){bmmDownloadBackup('antes-de-restaurar');state=normalize(clone(SEED));save('Datos base restaurados');setPage('dashboard');}
      return;
    }
    if(a==='reset-repertoire-filters'){repSearch='';repStyle='all';bmmRepHistoryFilter='all';render();return;}
    if(a==='restore-event-draft'){
      const form=document.getElementById('eventForm');if(!form)return;let d;try{d=JSON.parse(localStorage.getItem(BMM_DRAFT_KEY)||'null')}catch(_){d=null;}if(!d){showToast('No hay un borrador válido.',true);return;}
      Object.entries(d.fields||{}).forEach(([name,value])=>{const nodes=form.querySelectorAll(`[name="${CSS.escape(name)}"]`);nodes.forEach(n=>{if(n.type==='checkbox')n.checked=String(value)==='yes';else n.value=value;});});
      const wrap=form.querySelector('#marchRows');if(wrap&&Array.isArray(d.marches)){wrap.innerHTML=d.marches.map(p=>marchRowHtml(p)).join('')||marchRowHtml({});}
      (d.quick||[]).forEach(v=>{const c=form.querySelector(`input[name="quickMarchIds"][value="${CSS.escape(v)}"]`);if(c)c.checked=true;});
      form.querySelector('.bmm-draft-notice')?.remove();showToast('Borrador de actuación recuperado');return;
    }
    if(a==='discard-event-draft'){try{localStorage.removeItem(BMM_DRAFT_KEY)}catch(_){}document.querySelector('#eventForm .bmm-draft-notice')?.remove();showToast('Borrador descartado');return;}
    if(a==='import-csv-file'){document.getElementById('bmmCsvImportFile')?.click();return;}
    if(a==='confirm-csv-import'){const rows=bmmPendingCsvRows;bmmPendingCsvRows=null;closeModal();if(rows)bmmMergeCSVRows(rows);return;}
    if(a==='cloud-reload-conflict'){
      if(!bmmCloudConflictState){showToast('No hay ningún conflicto pendiente.',true);return;}
      if(confirm('Se reemplazarán los cambios locales por la última copia de la nube. ¿Has guardado una copia local si la necesitas?')){state=normalize(bmmCloudConflictState);try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(_){}bmmCloudConflictState=null;bmmAddAudit('Se recargó la versión de la nube tras detectar cambios concurrentes','Sincronización');save('Versión de la nube cargada');render();}
      return;
    }
    if(a==='cloud-overwrite-conflict'){
      if(!bmmCloudConflictState){showToast('No hay ningún conflicto pendiente.',true);return;}
      if(confirm('Vas a sobrescribir la versión más reciente de la nube con los datos de este dispositivo. Descarga una copia antes si tienes dudas. ¿Continuar?')){bmmForceCloudOverwrite=true;bmmSyncNow().finally(()=>{bmmForceCloudOverwrite=false;});}
      return;
    }
if(a==='import-json'){return bmmBaseHandleAtEnd(el);}
    return bmmBaseHandleAtEnd(el);
  };

  // Explicit CSV/XLSX import. CSV is parsed in-browser; XLSX parsing uses ZIP/XML APIs, no external dependency.
  function bmmParseCSV(text){
    text=String(text||'').replace(/^\uFEFF/,'');let delimiter=';';const first=text.split(/\r?\n/,1)[0]||'';let inQ=false,commas=0,semis=0;for(let i=0;i<first.length;i++){if(first[i]==='"'&&first[i+1]==='"'){i++;continue;}if(first[i]==='"')inQ=!inQ;else if(!inQ&&first[i]===',')commas++;else if(!inQ&&first[i]===';')semis++;}if(commas>semis)delimiter=',';
    const rows=[];let row=[],cell='',quote=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===delimiter&&!quote){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);row=[];cell='';}else cell+=c;}
    if(cell.length||row.length){row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);}return rows;
  }
  async function bmmInflateRaw(bytes){if(typeof DecompressionStream==='undefined')throw new Error('Este navegador no puede descomprimir XLSX. Guarda la hoja de Excel como CSV UTF-8 y vuelve a intentarlo.');const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(stream).arrayBuffer());}
  async function bmmParseXLSX(arrayBuffer){
    const data=new Uint8Array(arrayBuffer),view=new DataView(arrayBuffer);let eocd=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65558);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}if(eocd<0)throw new Error('No se reconoce el archivo XLSX.');
    const entries=view.getUint16(eocd+10,true),cdOffset=view.getUint32(eocd+16,true),files=new Map();let pos=cdOffset;
    for(let i=0;i<entries;i++){if(view.getUint32(pos,true)!==0x02014b50)break;const method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),nlen=view.getUint16(pos+28,true),elen=view.getUint16(pos+30,true),clen=view.getUint16(pos+32,true),local=view.getUint32(pos+42,true);const name=new TextDecoder().decode(data.slice(pos+46,pos+46+nlen));const loff=local;const lname=view.getUint16(loff+26,true),lextra=view.getUint16(loff+28,true),start=loff+30+lname+lextra;const compressed=data.slice(start,start+size);let bytes;if(method===0)bytes=compressed;else if(method===8)bytes=await bmmInflateRaw(compressed);else{pos+=46+nlen+elen+clen;continue;}files.set(name,new TextDecoder().decode(bytes));pos+=46+nlen+elen+clen;}
    const parser=new DOMParser();const workbook=parser.parseFromString(files.get('xl/workbook.xml')||'','application/xml');const firstSheet=workbook.getElementsByTagName('sheet')[0];if(!firstSheet)throw new Error('El archivo Excel no contiene hojas.');const relId=firstSheet.getAttribute('r:id')||firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');const rels=parser.parseFromString(files.get('xl/_rels/workbook.xml.rels')||'','application/xml');let target='worksheets/sheet1.xml';for(const rel of [...rels.getElementsByTagName('Relationship')])if(rel.getAttribute('Id')===relId)target=rel.getAttribute('Target');target=target.replace(/^\//,'');const sheetPath=target.startsWith('xl/')?target:'xl/'+target;const sheetXml=files.get(sheetPath);if(!sheetXml)throw new Error('No se encuentra la primera hoja del Excel.');
    const sst=parser.parseFromString(files.get('xl/sharedStrings.xml')||'<sst/>','application/xml');const strings=[...sst.getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent||'').join(''));
    const sheet=parser.parseFromString(sheetXml,'application/xml');const rows=[];for(const rowEl of [...sheet.getElementsByTagName('row')]){const out=[];for(const c of [...rowEl.getElementsByTagName('c')]){const ref=c.getAttribute('r')||'A1',letters=(ref.match(/^[A-Z]+/)||['A'])[0];let col=0;for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;col--;const type=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent||'';let val=type==='s'?(strings[Number(v)]||''):type==='inlineStr'?[...c.getElementsByTagName('t')].map(t=>t.textContent||'').join(''):v;out[col]=val;}rows.push(out.map(v=>v??''));}
    // Convert common Excel serial date/time values by their header names.
    const hdr=rows[0]||[];for(let ri=1;ri<rows.length;ri++)for(let ci=0;ci<hdr.length;ci++){const key=bmmTitleKey(hdr[ci]).replace(/ /g,'');const v=rows[ri][ci];if(!v||!/^\d+(?:\.\d+)?$/.test(String(v)))continue;const n=Number(v);if(['fecha','date','fechadeactuacion'].includes(key)&&n>20000&&n<80000){rows[ri][ci]=new Date((n-25569)*86400000).toISOString().slice(0,10);}else if(['hora','horadeinicio','horadeinterpretacion'].includes(key)&&n>=0&&n<1){const mins=Math.round(n*1440),h=String(Math.floor(mins/60)%24).padStart(2,'0'),m=String(mins%60).padStart(2,'0');rows[ri][ci]=h+':'+m;}}
    return rows;
  }
  function bmmRowsToRecords(matrix){
    if(!matrix||matrix.length<2)throw new Error('El archivo no contiene filas de datos.');
    const headers=matrix[0].map(h=>bmmTitleKey(h).replace(/ /g,''));
    const eventHeader=headers.some(h=>['evento','actuacion','nombredelevento','procesion'].includes(h));
    const explicitMarchHeader=headers.some(h=>['marcha','titulodelamarcha','nombredelamarcha','titulomarcha'].includes(h));
    const genericTitleHeader=headers.some(h=>['nombre','titulo','nombrecompleto'].includes(h));
    const rows=[];
    for(const line of matrix.slice(1)){const obj={};headers.forEach((h,i)=>obj[h]=String(line[i]??'').trim());if(Object.values(obj).some(Boolean))rows.push(obj);}
    const pick=(r,keys)=>{for(const k of keys){const key=bmmTitleKey(k).replace(/ /g,'');const v=r[key];if(v!==undefined&&String(v).trim()!=='')return String(v).trim();}return '';};
    return rows.map(r=>{
      const name=pick(r,['evento','actuacion','nombredelevento','procesion']);
      let march=pick(r,['marcha','titulodelamarcha','nombredelamarcha','titulomarcha']);
      // A one-column catalogue export commonly calls the title simply «Nombre» or «Título».
      if(!march&&!eventHeader&&!explicitMarchHeader&&genericTitleHeader)march=pick(r,['nombre','titulo','nombrecompleto']);
      return {date:bmmImportDate(pick(r,['fecha','date','fechadeactuacion'])),time:pick(r,['horadelevento','hora','hora de inicio','horadeinicio']),group:pick(r,['grupo','grupocampana','grupo campaña']),name,category:pick(r,['tipo','categoria','categoría','tipodeevento'])||'Otro',status:pick(r,['estado']),locality:pick(r,['localidad','lugar']),organizer:pick(r,['organiza','organizador','hermandad']),march,author:pick(r,['autor','compositor']),order:pick(r,['orden']),startTime:pick(r,['horadeinterpretacion','hora de interpretación']),duration:pick(r,['duracionmin','duración (min)','duracion']),location:pick(r,['ubicacion','momento ubicación','momento/ubicacion','momento/ubicación']),eventNotes:pick(r,['notasgenerales','notas generales','notas','observaciones']),performanceNotes:pick(r,['notasdeinterpretacion','notas de interpretación','observacionesdelamarcha']),style:pick(r,['estilo','tipo/estilo']),season:pick(r,['temporada','repertorio']),difficulty:pick(r,['dificultad']),yearComposed:pick(r,['añodecomposicion','añodecomposición','añocomposicion']),publisher:pick(r,['editorial','publicador']),marchNotes:pick(r,['notasdelamarcha','notas'])};
    }).filter(r=>r.name||r.march);
  }
  function bmmImportDate(value){const x=String(value||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(x))return x;let m=x.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return x;}
  function bmmMergeCSVRows(rows){
    let newEvents=0,updatedEvents=0,newPerformances=0,newMarches=0;const created=[];
    for(const row of rows){
      if(!row.name){
        if(!row.march)continue;
        const mk=bmmTitleKey(row.march);let march=state.repertoire.find(m=>bmmTitleKey(m.name)===mk);
        if(!march){march={id:uid('march'),name:row.march,author:row.author||'',style:row.style||'',season:row.season||'',difficulty:row.difficulty||'',yearComposed:row.yearComposed||'',publisher:row.publisher||'',notes:row.marchNotes||'Importada desde catálogo CSV/Excel. Revisa y completa la ficha si hace falta.',tags:['Importado']};state.repertoire.push(march);newMarches++;}
        else {if(!march.author&&row.author)march.author=row.author;if(!march.style&&row.style)march.style=row.style;if(!march.season&&row.season)march.season=row.season;if(!march.yearComposed&&row.yearComposed)march.yearComposed=row.yearComposed;if(!march.publisher&&row.publisher)march.publisher=row.publisher;}
        continue;
      }
      const date=row.date||'';const group=row.group||'';const key=[date,row.time,bmmTitleKey(group),bmmTitleKey(row.name),bmmTitleKey(row.category),bmmTitleKey(row.locality)].join('|');
      let ev=state.events.find(e=>[e.date||'',e.time||'',bmmTitleKey(e.group),bmmTitleKey(e.name),bmmTitleKey(e.category),bmmTitleKey(e.locality)].join('|')===key);
      if(!ev){ev={id:uid('event'),date,time:row.time||'',group,name:row.name,category:row.category||'Otro',status:/realizado|completado/i.test(row.status)?'Realizado':/cancelado/i.test(row.status)?'Cancelado':/planificado|pendiente/i.test(row.status)?'Planificado':(date&&date<bmmTodayKey()?'Realizado':'Planificado'),locality:row.locality||'',organizer:row.organizer||'',notes:row.eventNotes||'',tags:[],marches:[],reserves:[]};state.events.push(ev);newEvents++;created.push(ev);}else{updatedEvents++;if(!ev.time&&row.time)ev.time=row.time;if(!ev.locality&&row.locality)ev.locality=row.locality;if(!ev.organizer&&row.organizer)ev.organizer=row.organizer;if(!ev.notes&&row.eventNotes)ev.notes=row.eventNotes;}
      if(!ev.marches)ev.marches=[];if(!row.march)continue;
      const mk=bmmTitleKey(row.march);let march=state.repertoire.find(m=>bmmTitleKey(m.name)===mk);
      if(!march){march={id:uid('march'),name:row.march,author:row.author||'',style:row.style||'',season:row.season||'',difficulty:row.difficulty||'',yearComposed:row.yearComposed||'',publisher:row.publisher||'',notes:row.marchNotes||'Importada desde CSV/Excel. Revisa y completa la ficha si hace falta.',tags:['Importado']};state.repertoire.push(march);newMarches++;}
      else if(!march.author&&row.author)march.author=row.author;
      const ord=parseInt(row.order,10)||ev.marches.length+1;const impKey=[date,bmmTitleKey(row.name),mk,ord,bmmTitleKey(row.location),row.startTime||'',bmmTitleKey(row.performanceNotes)].join('|');
      const exists=ev.marches.some(p=>p.importKey===impKey||(p.marchId===march.id&&(+p.order||0)===ord&&bmmTitleKey(p.location)===bmmTitleKey(row.location)&&String(p.startTime||'')===String(row.startTime||'')&&bmmTitleKey(p.notes)===bmmTitleKey(row.performanceNotes)));
      if(!exists){ev.marches.push({id:uid('perf'),marchId:march.id,sourceTitle:row.march,order:ord,sourceStop:ord,location:row.location||'',startTime:row.startTime||'',duration:row.duration||'',notes:row.performanceNotes||'',importKey:impKey});newPerformances++;}
    }
    if(!state.categories)state.categories=[];rows.forEach(r=>{if(r.category&&!state.categories.includes(r.category))state.categories.push(r.category);});
    const groups=bmmUniq(state.events.map(e=>String(e.group||'').trim()).filter(Boolean));groups.forEach((name,i)=>{if(!state.groupsCatalog.some(g=>bmmTitleKey(g.name)===bmmTitleKey(name)))state.groupsCatalog.push({id:uid('group'),name,description:'Importado desde histórico CSV/Excel',color:bmmColors[i%bmmColors.length]});});
    save(`Importación completada: ${newEvents} eventos nuevos, ${newPerformances} marchas añadidas`);setPage('actuaciones');showToast(`Importación terminada. ${newEvents} eventos nuevos, ${newPerformances} apariciones y ${newMarches} títulos nuevos.`);
  }

  // Generic data portability: no schedule-specific import panel.
  function bmmAdvancedDataTools(){
    const hasConflict=!!bmmCloudConflictState;
    return `<section class="pro-card bmm-data-workbench" style="margin-top:18px"><div class="pro-card-head"><div><h2>Importación y portabilidad de datos</h2><p>Fusiona un histórico CSV/Excel o resuelve una copia en conflicto.</p></div><span class="audit-badge">Herramientas</span></div><div class="pro-card-body"><div class="bmm-data-tools-grid"><article><div class="bmm-tool-icon">⇅</div><h3>Importar histórico Excel / CSV</h3><p>Importa un archivo .xlsx o .csv. Se fusiona con los registros actuales, crea los títulos que falten y evita repetir filas idénticas.</p><p class="bmm-tool-note">No se borra el histórico existente. Antes de la importación se recomienda conservar una copia JSON.</p><div class="toolbar"><button class="btn btn-primary" data-action="import-csv-file">Seleccionar Excel / CSV</button><button class="btn btn-soft btn-small" data-action="export-csv">Exportar CSV</button><input class="hidden" type="file" id="bmmCsvImportFile" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div></article></div>${hasConflict?`<div class="bmm-cloud-conflict" role="alert"><h3>Hay cambios más recientes en la nube</h3><p>Para evitar perder datos, elige si cargar la versión remota o confirmar que quieres sobrescribirla con este dispositivo.</p><div class="toolbar"><button class="btn btn-soft" data-action="cloud-reload-conflict">Cargar copia de la nube</button><button class="btn btn-danger" data-action="cloud-overwrite-conflict">Sobrescribir la nube conscientemente</button></div></div>`:''}<div class="bmm-tool-note" style="margin-top:12px">Las estadísticas de veces interpretada solo cuentan las actuaciones marcadas como <strong>Realizado</strong>. Las marchas de eventos planificados aparecen como programa, no como historial interpretado.</div></div></section>`;
  }
  const bmmRenderConfigBeforeAdvancedTools=renderConfig;
  renderConfig=function(){return bmmRenderConfigBeforeAdvancedTools()+bmmAdvancedDataTools();};

  // Capture import flows before the legacy reset/import handlers. JSON restore is backed up first.
  document.addEventListener('change',async function(e){
    const input=e.target;if(!input)return;
    if(input.id==='importFile'){
      const file=input.files?.[0];if(!file)return;
      try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.repertoire)||!Array.isArray(parsed.events))throw new Error('Formato no válido');
        if(confirm(`La copia contiene ${parsed.repertoire.length} marchas y ${parsed.events.length} actuaciones. Se descargará una copia actual antes de reemplazar los datos. ¿Continuar?`)){bmmDownloadBackup('antes-de-restaurar-json');state=normalize(parsed);save('Copia JSON restaurada');setPage('dashboard');}
      }catch(err){showToast('No se ha podido importar la copia JSON: '+(err.message||'formato no válido'),true);}finally{input.value='';}e.stopImmediatePropagation();return;
    }
    if(input.id==='bmmCsvImportFile'){
      const file=input.files?.[0];if(!file)return;
      try{
        let matrix;if(/\.xlsx$/i.test(file.name))matrix=await bmmParseXLSX(await file.arrayBuffer());else if(/\.csv$/i.test(file.name)||file.type.includes('csv'))matrix=bmmParseCSV(await file.text());else throw new Error('Formato no compatible. Utiliza .xlsx o .csv.');
        bmmPendingCsvRows=bmmRowsToRecords(matrix);if(!bmmPendingCsvRows.length)throw new Error('No se han encontrado filas con nombre de evento o marcha.');
        const events=new Set(bmmPendingCsvRows.filter(r=>r.name).map(r=>[r.date,r.name,r.group].join('|'))).size;const performances=bmmPendingCsvRows.filter(r=>r.march).length;
        openModal('Confirmar importación del histórico',`Archivo: ${esc(file.name)}`,`<div class="bmm-import-summary"><div><strong>${events}</strong><span>Eventos detectados</span></div><div><strong>${performances}</strong><span>Filas con marcha</span></div><div><strong>${new Set(bmmPendingCsvRows.map(r=>bmmTitleKey(r.march)).filter(Boolean)).size}</strong><span>Títulos distintos</span></div></div><p>La importación añade los registros que no existan y conserva las fichas actuales. Antes de fusionar, se descargará una copia de seguridad.</p><p class="bmm-tool-note">Si tu archivo Excel tiene varias hojas, se leerá la primera hoja visible. Puedes exportar cada hoja por separado a CSV para importar otras tablas.</p>`,`<button class="btn btn-soft" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="confirm-csv-import">Crear copia e importar</button>`);
      }catch(err){bmmPendingCsvRows=null;showToast(err.message||'No se ha podido leer el archivo.',true);}finally{input.value='';}e.stopImmediatePropagation();return;
    }
  },true);

  // Cloud concurrency protection. Server 409 responses preserve the local data until the user decides.
  bmmSyncNow=async function(){
    if(!bmmCloudMode||!bmmAuthenticated||bmmSyncBusy)return false;bmmSyncBusy=true;
    try{
      const r=await fetch('/.netlify/functions/state',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,expectedCloudUpdatedAt:state.cloudUpdatedAt||null,force:bmmForceCloudOverwrite===true})});
      const b=await r.json().catch(()=>({}));
      if(r.status===409&&b.conflict){bmmCloudConflictState=b.state||null;showToast('Hay una versión más reciente en la nube. Revisa Ajustes antes de sobrescribir.',true);if(page==='configuracion')render();return false;}
      if(!r.ok)throw new Error(r.status===401?'Sesión caducada. Vuelve a entrar.':(b.error||'No se ha podido sincronizar.'));
      if(b.savedAt)state.cloudUpdatedAt=b.savedAt;state.cloudUpdatedBy='BMM';try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(_){}
      bmmCloudConflictState=null;const side=document.querySelector('.sidebar-bottom');if(side)side.innerHTML=`<div><span class="status-dot"></span>Guardado en la nube · ${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div><div style="margin-top:9px">BMM Santa Cecilia · Sincronizado</div><div style="margin-top:9px"><button class="btn btn-soft btn-small" data-page="configuracion">Ver registro de cambios</button></div>`;showToast('Cambios sincronizados en la nube');return true;
    }catch(err){showToast(err.message||'Error de sincronización',true);return false;}finally{bmmSyncBusy=false;}
  };
  const bmmLoadCloudBeforeTimestamp=bmmLoadCloud;
  bmmLoadCloud=async function(){const ok=await bmmLoadCloudBeforeTimestamp();if(ok)bmmCloudConflictState=null;return ok;};

  // Compact, separate theme tokens for report widgets and the import/draft controls.
  const bmmProV11Style=document.createElement('style');bmmProV11Style.id='bmm-pro-workbench-v11';bmmProV11Style.textContent=`
  .bmm-catalog-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0 14px}.bmm-catalog-summary>div{border:1px solid var(--bmm-border);border-top:3px solid #b7a04e;border-radius:13px;background:linear-gradient(145deg,var(--bmm-surface),var(--bmm-raised));padding:12px;min-width:0}.bmm-catalog-summary span{display:block;font-size:11px;color:var(--bmm-muted)}.bmm-catalog-summary strong{display:block;font-size:24px;color:var(--bmm-text);margin-top:4px}.bmm-catalog-filters{padding:12px;display:grid;grid-template-columns:minmax(0,2fr) minmax(125px,1fr) minmax(190px,1.3fr) auto auto;gap:8px;align-items:center}.bmm-catalog-filters .searchbox{min-width:0}.bmm-frequency{display:inline-grid;place-items:center;min-width:32px;height:30px;padding:0 8px;border-radius:10px;font-weight:800;background:var(--bmm-raised);color:var(--bmm-text)}.bmm-frequency.has-plays{background:#dfefe2;color:#175b39}.bmm-frequency.no-plays{background:var(--bmm-raised);color:var(--bmm-muted)}html[data-bmm-resolved-theme="dark"] .bmm-frequency.has-plays{background:#205137;color:#e4f3e6}html[data-bmm-resolved-theme="dark"] .bmm-catalog-summary>div{background:linear-gradient(140deg,#142d20,#0c2117)}
  .bmm-data-workbench{overflow:hidden}.bmm-data-tools-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.bmm-data-tools-grid article{border:1px solid var(--bmm-border);border-radius:14px;padding:15px;background:linear-gradient(145deg,var(--bmm-surface),var(--bmm-raised));min-width:0}.bmm-data-tools-grid h3{margin:9px 0 6px;font-size:15px;color:var(--bmm-text)}.bmm-data-tools-grid p{font-size:12px;line-height:1.55;color:var(--bmm-muted)}.bmm-tool-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:var(--bmm-raised);color:var(--green);font-size:20px}.bmm-tool-note{font-size:11px;color:var(--bmm-muted);line-height:1.5}.bmm-date-disclaimer{padding:10px 12px;border:1px solid #dac779;background:#fff6d9;border-radius:10px;color:#6e5519;font-size:12px;line-height:1.5}.bmm-import-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.bmm-import-summary>div{background:var(--bmm-raised);border:1px solid var(--bmm-border);border-radius:10px;text-align:center;padding:12px 7px}.bmm-import-summary strong{display:block;font-size:24px;color:var(--bmm-text)}.bmm-import-summary span{font-size:10px;color:var(--bmm-muted)}.bmm-cloud-conflict{margin-top:14px;border:1px solid #bd7c4d;background:color-mix(in srgb,#bc7236 10%,var(--bmm-surface));padding:13px;border-radius:12px}.bmm-cloud-conflict h3{color:var(--bmm-text);margin:0 0 5px}.bmm-cloud-conflict p{color:var(--bmm-muted);font-size:12px}.bmm-draft-notice{display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;padding:10px;border:1px solid var(--bmm-border);border-radius:10px;background:var(--bmm-raised);color:var(--bmm-text);font-size:12px}.bmm-confirm-date-field label{display:flex;align-items:center;gap:9px;text-transform:none!important;letter-spacing:0!important}.bmm-confirm-date-field small{display:block;color:var(--bmm-muted);font-size:10px;margin-top:6px}

  html[data-bmm-resolved-theme="dark"] .bmm-catalog-summary>div{border-color:#294c38;border-top-color:#d0b65e;background:linear-gradient(145deg,#143222,#0b2117)}
  html[data-bmm-resolved-theme="dark"] .bmm-frequency.has-plays{background:#1c5135;color:#e0f3e5}
  @media(max-width:760px){.bmm-catalog-summary{gap:7px}.bmm-catalog-summary>div{padding:10px}.bmm-catalog-summary span{font-size:9px}.bmm-catalog-summary strong{font-size:21px}.bmm-catalog-filters{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px}.bmm-catalog-filters .searchbox{grid-column:1/-1}.bmm-catalog-filters .btn{min-width:0;font-size:11px;padding:9px}.bmm-data-tools-grid{grid-template-columns:1fr}.bmm-data-tools-grid .toolbar .btn{flex:1 1 auto}.bmm-import-summary strong{font-size:20px}.bmm-draft-notice>div{display:flex;gap:6px}}
  @media(max-width:380px){.bmm-catalog-summary span{font-size:8px}.bmm-catalog-summary strong{font-size:18px}}
  `;document.head.appendChild(bmmProV11Style);

  // Release history and audit access. Update BMM_APP_VERSION and this release list with every published build.
  const BMM_APP_VERSION = '1.13.1';
  const BMM_VERSION_HISTORY = [
    {version:'1.13.1',date:'12/10/2026',title:'Integrantes legibles y despliegue depurado',notes:['Se corrige el ancho de los cuatro KPI en escritorio y tablet; los rótulos vuelven a ocupar líneas normales.','El despliegue usa un directorio dist limpio y deja fuera pruebas, auditorías, capturas y archivos auxiliares.','Se conserva el modelo de datos, el almacenamiento local, la cola, los ETags y las funciones de Netlify.']},
    {version:'1.13.0',date:'12/10/2026',title:'Auditoría integral · Interfaz, tablet y accesibilidad',notes:['Menú plegable en móvil y tablet, sin comprimir el contenido.','Diálogos accesibles, foco confinado y confirmación del descarte.','Tipografía, filtros, títulos largos e informes legibles en ambos temas.','Edición múltiple reparada y escape de identificadores; datos y sincronización conservados.']},
    {version:'1.12.0', date:'12/10/2026', title:'Fase E · Cola de sincronización persistente y recuperación', notes:['Se conserva una marca local ligera de cambios pendientes para sobrevivir a recargas y cierres de pestaña.','La cola nunca sustituye el estado musical ni contiene credenciales; utiliza la copia local ya existente y el control ETag del servidor.','Al recuperar conexión, la sincronización sigue pasando por las comprobaciones de conflicto y copia previa existentes.','Si la nube confirma que ya contiene la misma versión, se limpia la marca pendiente; si hay cambios reales concurrentes, se conserva el estado de conflicto.','No se cambia la región, el almacén ni el protocolo de escritura condicional.']},
    {version:'1.11.0', date:'12/10/2026', title:'Fase D · Calidad de datos e historial filtrable', notes:['Panel de calidad de datos de solo lectura para detectar títulos duplicados, fichas incompletas, actuaciones sin marchas y referencias rotas.','El historial de cambios se puede filtrar por sección, tipo de operación y texto, y exportar según los filtros activos.','Los detalles del historial de altas y ediciones de actuaciones, marchas y grupos incluyen el nombre del registro para facilitar la búsqueda.','No se corrigen ni eliminan datos automáticamente; se mantiene la sincronización de la v1.10.0.']},
    {version:'1.9.3', date:'12/10/2026', title:'Corrección de conflictos de nube y sincronización segura', notes:['Los identificadores heredados sin ID se normalizan de forma determinista.','Se mantiene la escritura condicional, el backup previo y la protección frente a conflictos reales.']},
    {version:'1.10.0', date:'12/10/2026', title:'Fase C · Analítica musical explicable y última interpretación', notes:['Los identificadores faltantes de registros heredados se generan de forma determinista para evitar discrepancias artificiales entre dispositivos.','Si los datos locales tienen cambios pendientes sobre la misma revisión de nube confirmada, se conservan y se sincronizan contra el ETag recién leído, en vez de declararse conflicto.','Si durante el guardado cambia el ETag pero la marca de revisión confirmada no ha avanzado, se permite un solo reintento condicional.','Solo se reconcilian automáticamente discrepancias de IDs sintetizados o respuestas donde la nube ya contiene los mismos datos; los cambios reales en datos musicales siguen protegidos por el flujo de conflicto.','Se conservan las copias de seguridad previas, la escritura condicional, el almacén y la región actuales. Caché PWA renovada.']},
    {version:'1.9.2', date:'12/10/2026', title:'Finalización automática y KPIs sincronizados', notes:['Las actuaciones pasan automáticamente a Realizado cuando la fecha completa del evento ya ha pasado; los eventos cancelados se mantienen cancelados.','KPIs, recuentos de interpretaciones, analítica y previsualizaciones de informes cuentan las interpretaciones de eventos realizados, usando la misma regla de estado.','El estado de eventos pasados se normaliza al abrir, cargar o editar datos y se intenta sincronizar de forma segura con la nube sin resolver conflictos automáticamente.','El panel lateral queda fijado a la ventana en escritorio y tablet, y como cajón fijo en móvil; su contenido puede desplazarse independientemente.','Caché PWA renovada; sin cambios en el almacén ni en la región de Netlify Blobs.']},
    {version:'1.9.1', date:'12/10/2026', title:'Repertorio responsive sin columna de estilo', notes:['Se elimina la columna Estilo del listado principal del repertorio para ampliar el espacio de los datos importantes.','En móvil, cada fila pasa a un diseño compacto con título, autor, última interpretación, frecuencia y acciones sin columnas excesivamente estrechas.','En escritorio, se reducen los rellenos de las filas y se establecen anchos de columna equilibrados; los textos largos se ajustan en varias líneas sin truncarse.','Se conserva el filtro por estilo, los datos del catálogo y toda la lógica de guardado y sincronización.']},
    {version:'1.9.0', date:'12/10/2026', title:'Fase 1 · Sistema visual común', notes:['Sistema de diseño común para tarjetas, controles, formularios y jerarquía tipográfica en todas las secciones.','Modales adaptables con cuerpo desplazable, acciones estables y respeto por las áreas seguras del móvil.','Estados de botones, foco visible, contraste reforzado y ajustes para movimiento reducido y preferencia de alto contraste.','Se conserva la lógica de negocio, los datos y las funciones de sincronización de v1.8.9.']},
    {version:'1.8.9', date:'12/10/2026', title:'Robustez de sincronización Netlify', notes:['Se alinea @netlify/blobs con la versión 10.7.13 usada por la aplicación de referencia que ya guarda correctamente.','La copia previa usa claves aleatorias únicas y se verifica mediante lectura antes de permitir reemplazar el estado actual.','El diagnóstico registra el código del servidor, el estado HTTP y el detalle seguro de la operación fallida.','Se conservan la protección contra conflictos, la copia previa y la región actual del almacén.']},
    {version:'1.8.8', date:'12/10/2026', title:'Rediseño responsive de actuaciones', notes:['Cabecera fija en móviles para mantener siempre visible el título y el acceso al menú.','Tarjetas de actuación y acordeones con mejor jerarquía, aire y tipografía adaptable.','Acciones en cuadrícula táctil y listado de marchas reorganizado para evitar textos y botones comprimidos.','La lógica de datos y sincronización se conserva sin cambios.']},
    {version:'1.8.7', date:'12/10/2026', title:'Robustez del guardado Cloud', notes:['Reintentos y verificación de la copia previa antes de reemplazar datos','Diagnóstico específico de errores de Netlify Blobs']},
    {version:'1.8.3', date:'12/10/2026', title:'Corrección de acceso en producción', notes:['Las funciones identifican el dominio canónico con URL, variable disponible en Functions runtime; no dependen de CONTEXT cuando este no está disponible.','Se bloquean hosts de Deploy Preview y se conserva el mismo almacén de datos.']},
    {version:'1.8.2', date:'12/10/2026', title:'Aislamiento del almacenamiento de producción', notes:['Las funciones de autenticación y datos rechazan Deploy Previews, branch deploys y Netlify Dev.','El guardado compartido solo responde cuando CONTEXT=production.','Se mantienen el nombre estable del Blob, la migración no destructiva, los ETags y las copias de recuperación.']},
    {version:'1.8.1', date:'12/10/2026', title:'Persistencia cloud independiente y guardado estable', notes:['Los datos compartidos se guardan en un almacén Netlify Blobs con nombre fijo e independiente del despliegue.','Se separó la hoja de estilos base y se dividió el JavaScript de arranque, flujos de aplicación, tema visual y gestión avanzada de marchas en archivos independientes.','Se reforzó la navegación por teclado, los controles táctiles y la adaptación a tabletas de anchura intermedia.','La PWA precarga los recursos nuevos para mejorar la disponibilidad sin conexión.','Se mantienen las funciones de orden, repetición, informes, copias y sincronización existentes.']},
    {version:'1.7.8', date:'12/10/2026', title:'Repetición ágil y orden visual de marchas', notes:['En el editor, el orden se gestiona con flechas y un indicador automático; ya no hace falta introducir números de orden manualmente.','La selección rápida permite añadir una marcha varias veces indicando cuántas apariciones se quieren agregar.','Nuevo editor por lotes para añadir una o varias marchas, incluidas repeticiones, a varias actuaciones seleccionadas en una sola operación.','Las apariciones repetidas mantienen identificadores independientes y conservan su hora, ubicación y notas individuales.']},
    {version:'1.7.7', date:'12/10/2026', title:'Fase 2 · Informes y PDF estandarizados', notes:['El PDF compartido extrae encabezados, párrafos y filas de tabla de la misma estructura del informe, conservando separaciones y jerarquía legible.','Mejorados los saltos de página, encabezados de sección y numeración de páginas del PDF compartido.','El PDF generado para compartir usa dimensiones A4 físicas y no depende del tamaño Carta predeterminado del sistema.']},
    {version:'1.7.6', date:'12/10/2026', title:'Fase 1 · Integridad local y sincronización segura', notes:['Cargar la nube desde Ajustes es una lectura y no genera otra escritura ni una versión artificial.','La sincronización protege los guardados concurrentes con ETags condicionales de Netlify Blobs y reconoce respuestas perdidas cuando la copia remota ya coincide.','Los datos locales ilegibles se conservan para recuperación y no se reemplazan automáticamente al iniciar.','Se mantienen copias locales previas y hasta ocho copias recuperables en la nube antes de reemplazar el estado compartido.','Las preferencias visuales permanecen en cada dispositivo y no modifican el estado musical compartido.','La conexión recuperada puede reintentar de forma limitada una sincronización pendiente, sin sobrescribir conflictos.']},
    {version:'1.7.5', date:'12/10/2026', title:'Informes separados por fecha y papel A4', notes:['Los informes de actuaciones agrupan las actuaciones bajo un encabezado visible por cada fecha y separan cada evento de su secuencia de marchas.','La cronología utiliza la misma separación por fecha para facilitar la lectura en papel.','La impresión declara el tamaño A4 mediante dimensiones físicas en milímetros, en vertical y horizontal, y refuerza la regla al final de la hoja de estilos.']},
    {version:'1.7.4', date:'12/10/2026', title:'Modo oscuro integral', notes:['Reconstruida la capa de tema oscuro para adaptar fondos, textos, tarjetas, tablas, controles y formularios.','Se conserva el tema claro y la preferencia automática por dispositivo.','Ajustes de contraste y colores de elementos interactivos.']},
    {version:'1.7.3', date:'12/10/2026', title:'Informes imprimibles y PDF compartible', notes:['Añadido botón Compartir PDF con el menú nativo de Android cuando el navegador admite compartir archivos.','El PDF también se descarga para compartirlo desde Descargas si el navegador no admite compartir archivos directamente.','Mejorada la alternativa de impresión cuando el navegador bloquea ventanas emergentes.']},
    {version:'1.7.2', date:'12/10/2026', title:'Orden y repetición de marchas', notes:['En el editor de actuaciones puedes subir o bajar cada marcha para definir el orden de interpretación.','Nuevo botón para duplicar una aparición de marcha, de forma que la misma pieza pueda registrarse varias veces en un acto.','Las repeticiones se guardan como interpretaciones independientes y cuentan separadamente en el histórico y los informes.']},
    {version:'1.7.1', date:'11/10/2026', title:'Corrección del error en Ajustes', notes:['Corregido el error bmmCloudMode is not defined que impedía abrir la sección de Ajustes en Netlify.','La pantalla base de personalización ya no depende de variables privadas del módulo de sincronización.','Caché PWA renovada para facilitar la actualización de los dispositivos.']},
    {version:'1.7.0', date:'11/10/2026', title:'Guardado y sincronización con la nube', notes:['La normalización conserva los metadatos de versión y todos los módulos de datos.','Ajustes incorpora acciones explícitas para guardar/sincronizar y cargar la copia compartida.','La cabecera muestra estado local, nube, cambios pendientes y conflictos.','Se refuerzan los controles de personalización y se renueva la caché PWA.']},
    {version:'1.6.0', date:'11/10/2026', title:'Calendario interactivo', notes:['Nueva sección de calendario mensual, con el día actual seleccionado al abrir.','Al pulsar un día se muestran las actuaciones, sus horarios, grupos, estados y marchas registradas.','Acceso rápido para crear una actuación con la fecha seleccionada e imprimir la agenda del día o del mes.']},
    {version:'1.5.1', date:'11/10/2026', title:'Desplazamiento responsive', notes:['Scroll vertical independiente del menú lateral en tablet y móvil.','Contenedores y tablas con desplazamiento interno cuando lo necesitan.']},
    {version:'1.5.0', date:'11/10/2026', title:'Registro de cambios y versiones', notes:['Acceso directo al registro de cambios desde el menú lateral.','Nuevo historial de versiones y detección de actualización en este dispositivo.','Retirada la herramienta de importación y el tipo de informe específico que ya no se utilizarán.','Importación genérica Excel/CSV, copias de seguridad y sincronización conservadas.']},
    {version:'1.4.0', date:'11/10/2026', title:'Gestión musical avanzada', notes:['Historial de interpretaciones reales y última fecha conocida.','Duplicación de actuaciones y borradores recuperables.','Importación de catálogo e histórico desde CSV/XLSX.','Informes A4 con orientación vertical u horizontal y previsualización.']},
    {version:'1.3.0', date:'11/10/2026', title:'Auditoría de temas y legibilidad', notes:['Paletas independientes para modo claro, oscuro y automático.','Mejoras de contraste en tablas, filtros, gráficos y formularios.','Ajustes de navegación móvil y cabeceras adaptables.']},
    {version:'1.2.0', date:'10/10/2026', title:'Navegación compacta y PWA', notes:['Menú lateral plegable para móvil y tablet.','Botón flotante de guardado y estado visual del guardado.','Preparación de instalación en Android como aplicación web progresiva.']},
    {version:'1.0.0', date:'09/10/2026', title:'Primera versión de gestión', notes:['Repertorio musical con autores.','Registro de actuaciones y marchas interpretadas.','Resumen, categorías y exportación de datos.']}
  ];
  const BMM_VERSION_SEEN_KEY='bmm-santa-cecilia-version-seen-v1';
  function bmmRecordCurrentVersionSeen(){
    try{
      const previous=JSON.parse(localStorage.getItem(BMM_VERSION_SEEN_KEY)||'[]');
      const records=Array.isArray(previous)?previous:[];
      if(!records.some(x=>x&&x.version===BMM_APP_VERSION)){
        records.unshift({version:BMM_APP_VERSION,firstSeenAt:new Date().toISOString()});
        localStorage.setItem(BMM_VERSION_SEEN_KEY,JSON.stringify(records.slice(0,40)));
      }
    }catch(_){}
  }
  function bmmVersionHistoryBody(){
    let seen=[];try{const v=JSON.parse(localStorage.getItem(BMM_VERSION_SEEN_KEY)||'[]');seen=Array.isArray(v)?v:[]}catch(_){}
    const current=BMM_VERSION_HISTORY[0];
    return `<div class="bmm-version-current"><span class="bmm-version-mark">✓</span><div><small>VERSIÓN ACTUAL</small><h3>BMM Santa Cecilia · v${esc(BMM_APP_VERSION)}</h3><p>La aplicación registra cuándo detecta una nueva versión en este dispositivo.</p></div></div><div class="bmm-version-timeline">${BMM_VERSION_HISTORY.map((v,i)=>`<article class="bmm-version-entry ${i===0?'is-current':''}"><div class="bmm-version-rail"><span></span></div><div class="bmm-version-entry-main"><div class="bmm-version-entry-top"><strong>v${esc(v.version)} · ${esc(v.title)}</strong><time>${esc(v.date)}</time></div>${i===0?'<span class="bmm-version-badge">Actual</span>':''}<ul>${v.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div></article>`).join('')}</div><section class="bmm-version-device"><h3>Versiones detectadas en este dispositivo</h3><p>Este registro se actualiza cuando se abre una versión nueva. Se guarda localmente en este navegador y no sustituye al historial de cambios de los datos.</p>${seen.length?`<div class="table-wrap"><table class="audit-table"><thead><tr><th>Versión</th><th>Detectada por primera vez</th></tr></thead><tbody>${seen.map(v=>`<tr><td><strong>v${esc(v.version||'—')}</strong></td><td>${v.firstSeenAt?esc(new Date(v.firstSeenAt).toLocaleString('es-ES')):'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p>Aún no hay registros de versiones en este dispositivo.</p>'}</section>`;
  }
  let bmmAuditQuery='', bmmAuditSection='all', bmmAuditKind='all';
  function bmmAuditFilteredRows(limit=500){
    const q=bmmAuditQuery.trim().toLocaleLowerCase('es');
    return bmmGetAudit().filter(x=>{
      const searchable=[x.at,bmmPageNames[x.page]||x.page,x.kind,x.label].join(' ').toLocaleLowerCase('es');
      return (!q||searchable.includes(q))&&(bmmAuditSection==='all'||x.page===bmmAuditSection)&&(bmmAuditKind==='all'||(x.kind||'Cambio')===bmmAuditKind);
    }).slice(0,limit);
  }
  function bmmAuditModalBody(){
    const all=bmmGetAudit(),rows=bmmAuditFilteredRows(500);
    const sections=[...new Set(all.map(x=>x.page).filter(Boolean))];
    const kinds=[...new Set(all.map(x=>x.kind||'Cambio'))].sort((a,b)=>a.localeCompare(b,'es'));
    return `<div class="bmm-audit-modal-tools"><span class="audit-badge">${rows.length} de ${all.length} registros</span><button class="btn btn-soft btn-small" data-action="export-audit">Exportar CSV filtrado</button></div><div class="bmm-audit-filters"><div class="field"><label for="bmmAuditQuery">Buscar en el historial</label><input id="bmmAuditQuery" type="search" value="${esc(bmmAuditQuery)}" placeholder="Actuación, marcha, acción…"></div><div class="field"><label for="bmmAuditSection">Sección</label><select id="bmmAuditSection"><option value="all">Todas las secciones</option>${sections.map(p=>`<option value="${esc(p)}" ${bmmAuditSection===p?'selected':''}>${esc(bmmPageNames[p]||p)}</option>`).join('')}</select></div><div class="field"><label for="bmmAuditKind">Tipo de cambio</label><select id="bmmAuditKind"><option value="all">Todos los tipos</option>${kinds.map(k=>`<option value="${esc(k)}" ${bmmAuditKind===k?'selected':''}>${esc(k)}</option>`).join('')}</select></div><button class="btn btn-soft btn-small" data-action="audit-reset-filters">Restablecer filtros</button></div><p class="bmm-modal-help">El historial incluye la fecha, sección, tipo y detalle del cambio. La búsqueda encuentra también los nombres de actuaciones y marchas incluidos en el detalle.</p>${rows.length?`<div class="table-wrap bmm-audit-modal-table"><table class="audit-table"><thead><tr><th>Fecha y hora</th><th>Sección</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(new Date(x.at).toLocaleString('es-ES'))}</td><td>${esc(bmmPageNames[x.page]||x.page||'—')}</td><td>${esc(x.kind||'Cambio')}</td><td>${esc(x.label||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><div class="empty-icon">◷</div><strong>Sin resultados</strong><span>Prueba con otros filtros o restablécelos.</span></div>'}`;
  }
  function bmmVersionHistoryCard(){
    const latest=BMM_VERSION_HISTORY[0];
    return `<section class="pro-card bmm-version-history-card"><div class="pro-card-head"><div><h2>Historial de versiones</h2><p>Versiones publicadas y cambios destacados de la aplicación.</p></div><span class="audit-badge">v${esc(BMM_APP_VERSION)}</span></div><div class="pro-card-body"><div class="bmm-version-summary"><span class="bmm-version-mark">↻</span><div><strong>${esc(latest.title)}</strong><small>v${esc(latest.version)} · ${esc(latest.date)}</small></div><button class="btn btn-soft btn-small" data-action="open-version-history">Ver historial</button></div><p class="bmm-modal-help">El registro de publicaciones se amplía con cada nueva versión; la aplicación también anota cuándo detecta una actualización en este dispositivo.</p></div></section>`;
  }
  function bmmSidebarAdminMarkup(){
    const status=bmmCloudMode?(bmmAuthenticated?'Sincronización en la nube':'Acceso pendiente'):'Guardado en este dispositivo';
    return `<div class="sidebar-status"><span class="status-dot"></span>${esc(status)}</div><div class="sidebar-versionline">BMM Santa Cecilia · v${esc(BMM_APP_VERSION)} · ${bmmCloudMode?'Nube':'Modo local'}</div><div class="sidebar-admin-links"><button type="button" class="sidebar-admin-btn" data-action="open-audit">◷ <span>Registro de cambios</span></button><button type="button" class="sidebar-admin-btn" data-action="open-version-history">↻ <span>Historial de versiones</span></button></div>`;
  }
  function bmmRefreshSidebarAdmin(){const side=document.querySelector('.sidebar-bottom');if(side)side.innerHTML=bmmSidebarAdminMarkup();}
  function bmmOpenAuditModal(){openModal('Registro de cambios','Actividad guardada en BMM Santa Cecilia',bmmAuditModalBody(),'<button class="btn btn-soft" type="button" data-action="close-modal">Cerrar</button><button class="btn btn-primary" type="button" data-action="export-audit">Exportar CSV</button>');}
  function bmmOpenVersionHistoryModal(){bmmRecordCurrentVersionSeen();openModal('Historial de versiones','Evolución de la aplicación y versiones detectadas',bmmVersionHistoryBody(),'<button class="btn btn-primary" type="button" data-action="close-modal">Cerrar</button>');}
  bmmRecordCurrentVersionSeen();
  // Keep the dark branded sidebar, with high-contrast labels even when the main interface is in light mode.
  const bmmRefreshStatusBeforeReleaseHistory=bmmRefreshStatus;
  bmmRefreshStatus=function(){try{bmmRefreshStatusBeforeReleaseHistory();}catch(_){}bmmRefreshSidebarAdmin();};
  const bmmSyncBeforeReleaseHistory=bmmSyncNow;
  bmmSyncNow=async function(){const result=await bmmSyncBeforeReleaseHistory();bmmRefreshSidebarAdmin();return result;};
  const bmmHandleBeforeReleaseHistory=handleAction;
  handleAction=function(el){const a=el?.dataset?.action;if(a==='open-audit'){bmmOpenAuditModal();return;}if(a==='open-version-history'){bmmOpenVersionHistoryModal();return;}return bmmHandleBeforeReleaseHistory(el);};
  const bmmRenderConfigBeforeVersionHistory=renderConfig;
  renderConfig=function(){return bmmRenderConfigBeforeVersionHistory()+bmmVersionHistoryCard();};

  // Calendario interactivo: la vista abre siempre en el día actual y muestra los detalles reales guardados.
  let bmmCalendarCursor = new Date();
  let bmmCalendarSelected = bmmTodayKey();
  const bmmCalendarDateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const bmmCalendarFormatLong = key => { const d=bmmDate(key); return d ? new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d) : 'Fecha sin indicar'; };
  const bmmCalendarSortEvents = list => [...list].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||(a.name||'').localeCompare(b.name||'','es'));
  function bmmCalendarEventMarkup(e){
    const marches=(e.marches||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0));
    const status=bmmStatus(e);
    return `<article class="bmm-cal-event">
      <div class="bmm-cal-event-top"><div class="bmm-cal-event-time">${e.time?`<strong>${esc(e.time)}</strong>`:'<strong>—</strong>'}<span>${esc(e.duration?e.duration+' min':'Actuación')}</span></div>
        <div class="bmm-cal-event-main"><h3>${esc(e.name)}</h3><div class="bmm-cal-event-meta"><span class="bmm-cal-pill">${esc(bmmGroup(e))}</span><span class="bmm-cal-pill">${esc(e.category||'Otro')}</span><span class="bmm-cal-status ${status==='Realizado'?'is-done':status==='Cancelado'?'is-cancelled':'is-planned'}">${esc(status)}</span></div>
        <p class="bmm-cal-location">${e.locality?`⌖ ${esc(e.locality)}`:'Lugar sin indicar'}${e.organizer?` · Organiza: ${esc(e.organizer)}`:''}</p></div>
        <button type="button" class="btn btn-soft btn-small" data-action="edit-event" data-id="${esc(e.id)}">✎ Editar</button></div>
      ${e.route?`<div class="bmm-cal-route"><strong>Recorrido</strong><span>${esc(e.route)}</span></div>`:''}
      ${e.notes?`<p class="bmm-cal-notes">${esc(e.notes)}</p>`:''}
      <div class="bmm-cal-marches-head"><strong>Marchas registradas</strong><span>${marches.length}</span></div>
      ${marches.length?`<ol class="bmm-cal-marches">${marches.map((p,i)=>{const m=getMarch(p.marchId);return `<li><span class="bmm-cal-order">${esc(p.order||i+1)}</span><span class="bmm-cal-march-info"><strong>${esc(m?.name||p.sourceTitle||'Marcha sin título')}</strong><small>${esc(m?.author||'Autor sin indicar')}${p.location?' · '+esc(p.location):''}</small>${p.notes?`<small class="bmm-cal-march-note">${esc(p.notes)}</small>`:''}</span></li>`}).join('')}</ol>`:'<div class="bmm-cal-no-marches">Esta actuación todavía no tiene marchas anotadas.</div>'}
    </article>`;
  }
  function renderCalendar(){
    const year=bmmCalendarCursor.getFullYear(), month=bmmCalendarCursor.getMonth();
    const first=new Date(year,month,1), daysInMonth=new Date(year,month+1,0).getDate();
    const offset=(first.getDay()+6)%7, cells=Math.ceil((offset+daysInMonth)/7)*7;
    const monthLabel=new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(first);
    const monthKey=`${year}-${String(month+1).padStart(2,'0')}`;
    const monthEvents=bmmCalendarSortEvents(state.events.filter(e=>(e.date||'').slice(0,7)===monthKey));
    const dayEvents=bmmCalendarSortEvents(state.events.filter(e=>e.date===bmmCalendarSelected));
    const dayCounts={};state.events.forEach(event=>{dayCounts[event.date]=(dayCounts[event.date]||0)+1});
    const weekNames=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const dayCells=[];
    for(let i=0;i<cells;i++){
      const dayNo=i-offset+1, d=new Date(year,month,dayNo), key=bmmCalendarDateKey(d), inMonth=d.getMonth()===month;
      const count=dayCounts[key]||0;
      const cls=['bmm-cal-day',inMonth?'':'is-outside',key===bmmTodayKey()?'is-today':'',key===bmmCalendarSelected?'is-selected':'',count?'has-events':''].filter(Boolean).join(' ');
      const aria=`${d.getDate()}${count?` ${count} ${count===1?'acto':'actos'}`:''}. ${bmmCalendarFormatLong(key)}${count?'':'. Sin actuaciones'}`;
      dayCells.push(`<button type="button" class="${cls}" data-calendar-day="${esc(key)}" aria-label="${esc(aria)}" aria-pressed="${key===bmmCalendarSelected?'true':'false'}"><span class="bmm-cal-day-number">${d.getDate()}</span> ${count?`<span class="bmm-cal-day-count">${count} ${count===1?'acto':'actos'}</span>`:'<span class="bmm-cal-day-empty"></span>'}${key===bmmTodayKey()?'<span class="bmm-cal-today-dot" aria-hidden="true"></span>':''}</button>`);
    }
    const countCalendarMarches=items=>items.reduce((n,e)=>n+(e.marches||[]).length,0);
    const eventsInMonth=monthEvents.length, monthPlays=countCalendarMarches(monthEvents), selectedPlays=countCalendarMarches(dayEvents);
    return `<div class="page-head bmm-cal-page-head"><div><div class="eyebrow">Agenda de la banda</div><h1>Calendario</h1><p>Consulta lo que ocurrió o está previsto cada día. Al abrir esta sección se selecciona automáticamente la fecha de hoy.</p></div><div class="toolbar"><button class="btn btn-primary" data-action="calendar-add-event">＋ Nueva actuación este día</button></div></div>
      <section class="bmm-cal-summary" aria-label="Resumen del calendario"><div><span class="bmm-cal-summary-icon">▦</span><div><small>Eventos del mes</small><strong>${bmmFormatNum(eventsInMonth)}</strong></div></div><div><span class="bmm-cal-summary-icon is-gold">♫</span><div><small>Marchas incluidas en el mes</small><strong>${bmmFormatNum(monthPlays)}</strong></div></div><div><span class="bmm-cal-summary-icon is-blue">◷</span><div><small>Eventos del día seleccionado</small><strong>${bmmFormatNum(dayEvents.length)}</strong></div></div></section>
      <section class="pro-card bmm-calendar-card"><div class="pro-card-head bmm-calendar-header"><div><div class="bmm-cal-month-kicker">Agenda mensual</div><h2>${esc(monthLabel.charAt(0).toLocaleUpperCase('es-ES')+monthLabel.slice(1))}</h2><p>Selecciona un día para consultar sus detalles.</p></div><div class="bmm-cal-month-actions"><button type="button" class="btn btn-soft btn-small" data-calendar-shift="-1" aria-label="Mes anterior">←</button><button type="button" class="btn btn-soft btn-small" data-calendar-today>Hoy</button><button type="button" class="btn btn-soft btn-small" data-calendar-shift="1" aria-label="Mes siguiente">→</button></div></div>
      <div class="bmm-calendar-grid" role="group" aria-label="${esc(monthLabel)}">${weekNames.map(w=>`<div class="bmm-cal-weekday" aria-hidden="true">${w}</div>`).join('')}${dayCells.join('')}</div>
      <div class="bmm-cal-legend"><span><i class="is-today"></i>Hoy</span><span><i class="has-event"></i>Día con actuaciones</span><span><i class="is-selected"></i>Día seleccionado</span></div></section>
      <section class="pro-card bmm-cal-day-panel"><div class="pro-card-head"><div><div class="bmm-cal-month-kicker">Detalle diario</div><h2>${esc(bmmCalendarFormatLong(bmmCalendarSelected).replace(/^./,c=>c.toLocaleUpperCase('es-ES')))}</h2><p>${dayEvents.length?`${dayEvents.length} ${dayEvents.length===1?'actuación':'actuaciones'} · ${selectedPlays} ${selectedPlays===1?'marcha anotada':'marchas anotadas'}`:'No hay actuaciones registradas en esta fecha.'}</p></div><div class="toolbar"><button type="button" class="btn btn-soft btn-small" data-action="calendar-pdf-day" ${dayEvents.length?'':'disabled'}>▧ PDF del día</button><button type="button" class="btn btn-primary btn-small" data-action="calendar-add-event">＋ Añadir</button></div></div>
      <div class="bmm-cal-day-content">${dayEvents.length?`<div class="bmm-cal-events-list">${dayEvents.map(bmmCalendarEventMarkup).join('')}</div>`:`<div class="bmm-cal-empty"><span class="bmm-cal-empty-icon">☼</span><strong>Un día por organizar</strong><p>No hay eventos anotados para esta fecha. Puedes crear una actuación y quedará guardada con este día.</p><button type="button" class="btn btn-primary" data-action="calendar-add-event">＋ Crear actuación para esta fecha</button></div>`}</div>
      <div class="bmm-cal-month-footer"><div><strong>Agenda del mes</strong><span>${eventsInMonth?`${eventsInMonth} actuaciones y ${monthPlays} marchas anotadas.`:'No hay actuaciones para este mes.'}</span></div><button type="button" class="btn btn-soft btn-small" data-action="calendar-pdf-month" ${monthEvents.length?'':'disabled'}>▧ PDF del mes</button></div></section>`;
  }
  function bmmCalendarPrint(events, title){
    if(!events.length){showToast('No hay actuaciones para imprimir en esta selección.',true);return;}
    const ordered=bmmCalendarSortEvents(events);
    const body=`<div class="report-doc"><div class="report-doc-header"><img class="report-doc-logo" src="assets/escudo-santa-cecilia.jpg" alt="Escudo Santa Cecilia"><div><div class="report-doc-kicker">BMM Santa Cecilia de Arjonilla · agenda</div><h1>${esc(title)}</h1><div class="report-doc-subtitle">${ordered.length} ${ordered.length===1?'actuación':'actuaciones'} · Generado el ${esc(new Date().toLocaleDateString('es-ES'))}</div></div></div>${ordered.map(e=>bmmEventReportBody(e)).join('')}</div>`;
    bmmPrintObjectReport(title,body);
  }
  // En cada entrada a Calendario se parte del día real del dispositivo; navegar dentro del calendario respeta la selección.
  const bmmSetPageBeforeCalendar=setPage;
  setPage=function(p){if(p==='calendario'){const now=new Date();bmmCalendarCursor=new Date(now.getFullYear(),now.getMonth(),1);bmmCalendarSelected=bmmTodayKey();}return bmmSetPageBeforeCalendar(p);};
  const bmmRenderBeforeCalendar=render;
  render=function(){
    if(page!=='calendario')return bmmRenderBeforeCalendar();
    const title=document.getElementById('topTitle'),today=document.getElementById('dateToday'),root=document.getElementById('content');
    if(!title||!today||!root)return;
    title.textContent=bmmPageNames.calendario;today.textContent=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short'}).format(new Date());
    document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    try{root.innerHTML=renderCalendar();window.bmmSyncCompactNav?.();}catch(err){console.error('Error al mostrar Calendario',err);root.innerHTML=`<section class="pro-card"><div class="pro-card-body"><h2>No se ha podido mostrar el calendario</h2><p>Los datos se conservan. Vuelve a intentarlo o descarga una copia desde Ajustes.</p><button class="btn btn-primary" data-action="retry-render">Volver a cargar</button></div></section>`;}
  };
  document.addEventListener('click',function(e){
    const day=e.target.closest('[data-calendar-day]');
    if(day){bmmCalendarSelected=day.dataset.calendarDay;const d=bmmDate(bmmCalendarSelected);if(d)bmmCalendarCursor=new Date(d.getFullYear(),d.getMonth(),1);render();return;}
    const shift=e.target.closest('[data-calendar-shift]');
    if(shift){const oldDay=parseInt((bmmCalendarSelected||'').slice(8,10),10)||1;const d=new Date(bmmCalendarCursor.getFullYear(),bmmCalendarCursor.getMonth()+Number(shift.dataset.calendarShift),1);bmmCalendarCursor=d;const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();bmmCalendarSelected=bmmCalendarDateKey(new Date(d.getFullYear(),d.getMonth(),Math.min(oldDay,lastDay)));render();return;}
    const today=e.target.closest('[data-calendar-today]');if(today){const now=new Date();bmmCalendarCursor=new Date(now.getFullYear(),now.getMonth(),1);bmmCalendarSelected=bmmTodayKey();render();return;}
  });
  const bmmHandleBeforeCalendar=handleAction;
  handleAction=function(el){const a=el?.dataset?.action;if(a==='calendar-add-event'){eventForm();const input=document.querySelector('#eventForm [name="date"]');if(input)input.value=bmmCalendarSelected;return;}if(a==='calendar-pdf-day'){bmmCalendarPrint(state.events.filter(e=>e.date===bmmCalendarSelected),'Agenda del día · '+bmmCalendarFormatLong(bmmCalendarSelected));return;}if(a==='calendar-pdf-month'){const key=`${bmmCalendarCursor.getFullYear()}-${String(bmmCalendarCursor.getMonth()+1).padStart(2,'0')}`;bmmCalendarPrint(state.events.filter(e=>(e.date||'').slice(0,7)===key),'Agenda mensual · '+new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(bmmCalendarCursor));return;}return bmmHandleBeforeCalendar(el);};

  // Reliable data status, cloud version stamps, and explicit cloud actions from Ajustes.
  let bmmDataStatusError = false;
  let bmmCloudPending = false;
  let bmmFormDirty = false;
  let bmmCloudQueued = false;
  let bmmCloudLastSavedAt = null;

  function bmmGetDataStatus(){
    if(bmmCloudConflictState) return {key:'conflict',label:'Conflicto de nube',detail:'Hay otra copia guardada; decide cuál conservar.'};
    if(bmmSyncBusy) return {key:'syncing',label:'Sincronizando nube…',detail:'La copia local se mantiene mientras se sincroniza.'};
    if(bmmFormDirty) return {key:'pending-form',label:'Cambios pendientes',detail:'Termina la edición y pulsa Guardar para conservarla.'};
    if(bmmDataStatusError) return {key:'error',label:'Error de sincronización',detail:'La copia local se conserva; revisa la conexión y vuelve a sincronizar.'};
    if(bmmCloudMode&&bmmAuthenticated){
      if(bmmCloudPending) return {key:'pending-cloud',label:'Local guardado · nube pendiente',detail:'Los cambios están guardados en este dispositivo y esperan sincronizarse.'};
      return {key:'cloud-saved',label:'Guardado local y en la nube',detail:'La copia de este dispositivo y la copia compartida están sincronizadas.'};
    }
    return {key:'local-saved',label:'Guardado en este dispositivo',detail:'Estos datos están guardados en este navegador; no se han sincronizado con la nube.'};
  }
  function bmmUpdateDataStatusUI(){
    const status=bmmGetDataStatus();
    document.querySelectorAll('.bmm-data-status-chip').forEach(node=>{
      node.dataset.status=status.key;
      node.title=status.detail;
      const label=node.querySelector('.bmm-data-status-label');
      if(label)label.textContent=status.label;
      node.setAttribute('aria-label',status.label+'. '+status.detail);
    });
    const sidebar=document.querySelector('.sidebar-status');
    if(sidebar){sidebar.dataset.status=status.key;sidebar.title=status.detail;sidebar.innerHTML=`<span class="status-dot" aria-hidden="true"></span><span>${esc(status.label)}</span>`;}
    const float=document.getElementById('bmmFloatingSaveBtn');
    if(float){float.dataset.status=status.key;float.title=status.detail;const label=float.querySelector('.bmm-save-label');if(label&& !window.bmmSaveStateTimer){label.textContent=status.key==='pending-form'?'Guardar cambios':status.key==='pending-cloud'?'Sincronizar cambios':status.key==='conflict'?'Resolver conflicto':'Guardar';}}
    document.querySelectorAll('[data-bmm-cloud-sync-state]').forEach(node=>{node.dataset.status=status.key;node.textContent=status.label;node.title=status.detail;});
  }
  function bmmSetDataStatusError(value){bmmDataStatusError=!!value;bmmUpdateDataStatusUI();}
  const bmmRefreshTopbarBeforeDataStatus=bmmRefreshTopbar;
  bmmRefreshTopbar=function(){
    bmmRefreshTopbarBeforeDataStatus();
    const host=document.querySelector('.top-right');if(!host)return;
    let chip=host.querySelector('.bmm-data-status-chip');
    if(!chip){chip=document.createElement('span');chip.className='bmm-data-status-chip';chip.innerHTML='<span class="bmm-data-status-dot" aria-hidden="true"></span><span class="bmm-data-status-label"></span>';host.appendChild(chip);}
    if(!host.querySelector('[data-action="add-event"]')){const add=document.createElement('button');add.type='button';add.className='btn btn-primary bmm-top-add-event';add.dataset.action='add-event';add.textContent='＋ Nueva actuación';host.appendChild(add);}
    bmmUpdateDataStatusUI();
  };
  const bmmRefreshStatusBeforeDataStatus=bmmRefreshStatus;
  bmmRefreshStatus=function(){try{bmmRefreshStatusBeforeDataStatus();}catch(_){}bmmUpdateDataStatusUI();};

  // Any persisted mutation is locally saved first; cloud status remains pending until Netlify confirms it.
  const bmmSaveBeforeStatusPipeline=save;
  save=function(msg='Cambios guardados'){
    const previousCloudPending=bmmCloudPending;
    bmmFormDirty=false;bmmDataStatusError=false;bmmCloudPending=!!(bmmCloudMode&&bmmAuthenticated);
    const result=bmmSaveBeforeStatusPipeline(msg);
    if(result===false){bmmCloudPending=previousCloudPending;bmmDataStatusError=true;}
    bmmUpdateDataStatusUI();
    return result;
  };
  function bmmDataFormIsEditable(form){return !!form&&/^(eventForm|marchForm|categoryForm|bmmMemberForm|groupForm|bmmGroupForm|memberForm)$/.test(form.id||'');}
  document.addEventListener('input',function(e){const form=e.target?.closest?.('form');if(!bmmDataFormIsEditable(form))return;bmmFormDirty=true;bmmDataStatusError=false;bmmUpdateDataStatusUI();},true);
  document.addEventListener('change',function(e){const form=e.target?.closest?.('form');if(!bmmDataFormIsEditable(form))return;bmmFormDirty=true;bmmDataStatusError=false;bmmUpdateDataStatusUI();},true);
  // Theme changes are local presentation settings, not pending cloud data.

  function bmmCanonicalPayload(value,isRoot=true){
    if(Array.isArray(value))return value.map(item=>bmmCanonicalPayload(item,false));
    if(value&&typeof value==='object'){
      const out={};Object.keys(value).filter(key=>!(isRoot&&['cloudUpdatedAt','cloudUpdatedBy'].includes(key))).sort().forEach(key=>{out[key]=bmmCanonicalPayload(value[key],false);});return out;
    }
    return value;
  }
  function bmmPayloadForComparison(value){return JSON.stringify(bmmCanonicalPayload(value||{},true));}
  // Older cloud snapshots may lack IDs for records which the client synthesized
  // during normalization. Ignore ONLY those synthesized IDs for migration checks;
  // all musical fields, row order, additions and deletions must still match.
  function bmmPayloadWithoutSynthesizedIds(value, rawRemote){
    const projected=clone(value||{});
    const objects=list=>Array.isArray(list)?list.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)):[];
    for(const field of ['events','repertoire','members']){
      const rawRows=objects(rawRemote?.[field]),normalizedRows=objects(projected[field]);
      rawRows.forEach((raw,index)=>{if(!String(raw.id||'').trim()&&normalizedRows[index])delete normalizedRows[index].id;});
    }
    const rawEvents=objects(rawRemote?.events),events=objects(projected.events);
    rawEvents.forEach((rawEvent,index)=>{
      const rawPlays=objects(rawEvent.marches),normalizedPlays=objects(events[index]?.marches);
      rawPlays.forEach((rawPlay,playIndex)=>{if(!String(rawPlay.id||'').trim()&&normalizedPlays[playIndex])delete normalizedPlays[playIndex].id;});
    });
    const rawGroups=objects(rawRemote?.groupsCatalog);
    const rawGroupByName=new Map(rawGroups.map(group=>[String(group.name||'').trim().toLocaleLowerCase('es'),group]));
    objects(projected.groupsCatalog).forEach(group=>{
      const raw=rawGroupByName.get(String(group.name||'').trim().toLocaleLowerCase('es'));
      if(!raw||!String(raw.id||'').trim())delete group.id;
    });
    return projected;
  }
  function bmmEquivalentAfterLegacyIdNormalization(localValue, normalizedRemote, rawRemote){
    return bmmPayloadForComparison(bmmPayloadWithoutSynthesizedIds(localValue,rawRemote))===
      bmmPayloadForComparison(bmmPayloadWithoutSynthesizedIds(normalizedRemote,rawRemote));
  }
  // A local snapshot can contain unsynced edits while retaining the last successful cloud timestamp.
  // Equal non-empty timestamps mean both copies still share the same acknowledged cloud base.
  const bmmSameCloudBaseRevision=(local,remote)=>{const a=String(local?.cloudUpdatedAt||'');const b=String(remote?.cloudUpdatedAt||'');return !!a&&a===b;};
  // Single-flight cloud write; concurrent local edits are queued instead of losing the last sync.
  bmmSyncNow=async function(){
    if(!bmmCloudMode||!bmmAuthenticated){bmmUpdateDataStatusUI();showToast('La nube solo está disponible después de iniciar sesión en Netlify.',true);return false;}
    if(bmmCloudConflictState&&!bmmForceCloudOverwrite){bmmUpdateDataStatusUI();showToast('Resuelve el conflicto en Ajustes antes de volver a sincronizar.',true);return false;}
    if(bmmSyncBusy){bmmCloudQueued=true;return false;}
    bmmSyncBusy=true;bmmDataStatusError=false;bmmUpdateDataStatusUI();
    let syncHttpStatus=null, syncServerCode=null;
    const snapshot=clone(state);const forced=bmmForceCloudOverwrite===true;let followUpRequired=false;
    try{
      const r=await fetch('/.netlify/functions/state',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,expectedCloudUpdatedAt:snapshot.cloudUpdatedAt||null,force:forced})});
      const body=await r.json().catch(()=>({}));
      if(r.status===409&&body.conflict){
        const wasAlreadyConflict=!!bmmCloudConflictState;
        bmmCloudConflictState=body.state||null;bmmCloudPending=true;bmmDataStatusError=false;bmmUpdateDataStatusUI();
        if(page==='configuracion')render();
        if(!wasAlreadyConflict)showToast('Hay una copia más reciente en la nube. Revisa Ajustes para cargarla o sobrescribirla de forma consciente.',true);
        return false;
      }
      if(!r.ok){const err=new Error(body.error||`La función state respondió HTTP ${r.status}.`);bmmRecordDiagnostic('Guardar estado en Netlify',err,{endpoint:'/.netlify/functions/state',httpStatus:r.status,code:r.status===401?'BMM-AUTH-401':r.status===403?'BMM-DEPLOY-403':r.status===409?'BMM-CLOUD-CONFLICT':r.status===413?'BMM-STATE-413':'BMM-STATE-HTTP-ERROR'});throw new Error(r.status===401?'La sesión de Netlify ha caducado. Inicia sesión de nuevo.':(body.error||`No se ha podido guardar en la nube (HTTP ${r.status}).`));}
      const savedAt=body.savedAt||new Date().toISOString();
      state.cloudUpdatedAt=savedAt;state.cloudUpdatedBy='BMM';bmmCloudLastSavedAt=savedAt;
      try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(err){throw new Error('La nube se guardó, pero no se pudo actualizar la copia local. Descarga un JSON de seguridad.');}
      const editedDuringSync=bmmPayloadForComparison(state)!==bmmPayloadForComparison(snapshot);
      bmmCloudPending=editedDuringSync;followUpRequired=editedDuringSync;bmmDataStatusError=false;bmmCloudConflictState=null;
      bmmOnlineRetryCount=0;if(!editedDuringSync)bmmAutoSyncWhenOnline=false;
      bmmUpdateDataStatusUI();
      if(!editedDuringSync){bmmFlashSaveState('Guardado');showToast('Datos guardados localmente y sincronizados con Netlify');}
      return true;
    }catch(err){bmmDataStatusError=true;bmmCloudPending=true;bmmUpdateDataStatusUI();showToast(err.message||'Error de sincronización. La copia local se mantiene.',true);return false;}
    finally{
      bmmSyncBusy=false;bmmUpdateDataStatusUI();
      const needsFollowUp=bmmCloudQueued||followUpRequired;bmmCloudQueued=false;if(bmmSyncTimer)clearTimeout(bmmSyncTimer);bmmSyncTimer=null;if(needsFollowUp&&!bmmCloudConflictState)bmmSyncTimer=setTimeout(()=>bmmSyncNow(),450);
      if(page==='configuracion')render();
    }
  };
  bmmDebouncedCloud=function(){if(!bmmCloudMode||!bmmAuthenticated||bmmCloudConflictState)return;if(bmmSyncTimer)clearTimeout(bmmSyncTimer);bmmSyncTimer=setTimeout(()=>bmmSyncNow(),900);};
  bmmScheduleCloudSave=function(){bmmDebouncedCloud();};

  async function bmmSaveCloudFromSettings(){
    if(bmmFormDirty){showToast('Hay un formulario con cambios sin confirmar. Pulsa Guardar dentro del formulario antes de sincronizar.',true);return;}
    if(!bmmCloudMode||!bmmAuthenticated){showToast('Inicia sesión en Netlify para sincronizar con la nube. Los datos locales no se han borrado.',true);return;}
    try{localStorage.setItem(STORE_KEY,JSON.stringify(state));bmmCloudPending=true;bmmDataStatusError=false;}catch(_){showToast('No se pudo guardar la copia local. Exporta un JSON antes de continuar.',true);return;}
    bmmUpdateDataStatusUI();await bmmSyncNow();
  }
  async function bmmLoadCloudFromSettings(){
    if(!bmmCloudMode||!bmmAuthenticated){showToast('Inicia sesión en Netlify para cargar los datos compartidos.',true);return;}
    if(!confirm('Se reemplazarán los datos que tienes abiertos por la última copia guardada en la nube. Antes se descargará una copia JSON de seguridad. ¿Continuar?'))return;
    if(!bmmDownloadBackup('antes-de-cargar-nube'))return;
    bmmDataStatusError=false;bmmUpdateDataStatusUI();
    let r,body;
    try{r=await fetch('/.netlify/functions/state',{method:'GET',credentials:'same-origin',cache:'no-store'});body=await r.json().catch(()=>({}));}
    catch(_){bmmDataStatusError=true;bmmUpdateDataStatusUI();showToast('No se pudo contactar con Netlify. Se han conservado los datos actuales.',true);return;}
    if(r.status===401||!r.ok){bmmDataStatusError=true;bmmUpdateDataStatusUI();showToast(body.error||'No se ha podido cargar la nube. Comprueba la sesión.',true);return;}
    if(!body.state||!Array.isArray(body.state.events)||!Array.isArray(body.state.repertoire)){showToast('La nube todavía no contiene una copia válida de los datos.',true);return;}
    state=normalize(body.state);bmmCloudConflictState=null;bmmFormDirty=false;bmmCloudPending=false;bmmDataStatusError=false;
    bmmAddAudit('Se cargaron los datos desde la nube','Sincronización');
    try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(_){bmmDataStatusError=true;showToast('La nube se ha cargado, pero el navegador no ha podido guardar la copia local.',true);}
    bmmCloudPending=true;render();bmmUpdateDataStatusUI();const synced=await bmmSyncNow();
    if(synced)showToast('Datos cargados desde la nube y sincronizados');
  }
  function bmmCloudDataPanel(){
    const status=bmmGetDataStatus();
    const cloudTime=state.cloudUpdatedAt?new Date(state.cloudUpdatedAt).toLocaleString('es-ES'):'Aún no hay una marca de sincronización local';
    const access=bmmCloudMode?(bmmAuthenticated?'Sesión de Netlify activa':'Netlify detectado · falta iniciar sesión'):'Modo local · nube no conectada';
    return `<section class="pro-card bmm-cloud-data-panel" style="margin-top:18px"><div class="pro-card-head"><div><h2>Estado y gestión de datos</h2><p>Comprueba dónde están guardados los datos y decide cuándo cargar o sincronizar la copia compartida.</p></div><span class="bmm-data-status-pill" data-status="${esc(status.key)}">${esc(status.label)}</span></div><div class="pro-card-body"><div class="bmm-cloud-metrics"><div><span>Repertorio</span><strong>${(state.repertoire||[]).length}</strong><small>marchas</small></div><div><span>Actuaciones</span><strong>${(state.events||[]).length}</strong><small>eventos</small></div><div><span>Interpretaciones anotadas</span><strong>${(state.events||[]).reduce((n,e)=>n+(e.marches||[]).length,0)}</strong><small>registros</small></div></div><div class="bmm-cloud-detail"><span class="bmm-data-status-dot" data-status="${esc(status.key)}" aria-hidden="true"></span><div><strong>${esc(access)}</strong><p data-bmm-cloud-sync-state data-status="${esc(status.key)}">${esc(status.label)}</p><small>Última marca de nube conocida: ${esc(cloudTime)}</small></div></div><div class="bmm-cloud-actions"><button type="button" class="btn btn-primary" data-action="cloud-save-from-settings">Guardar y sincronizar ahora</button><button type="button" class="btn btn-soft" data-action="cloud-load-from-settings">Cargar datos desde la nube</button><button type="button" class="btn btn-soft" data-action="export-json">Descargar copia JSON</button><button type="button" class="btn btn-soft" data-action="import-json">Cargar copia JSON</button><button type="button" class="btn btn-soft" data-action="diagnostics-open">Ver diagnóstico técnico</button></div><p class="bmm-cloud-help">La copia local se guarda primero. La sincronización solo se considera completada cuando Netlify confirma el guardado. Si hay cambios de otro dispositivo, tendrás que elegir explícitamente qué copia conservar.</p>${bmmCloudConflictState?`<div class="bmm-cloud-conflict" role="alert"><h3>La nube contiene cambios posteriores</h3><p>No se ha sobrescrito ninguna copia. Puedes recuperar lo que hay en la nube o reemplazarlo de forma consciente desde las opciones de resolución del conflicto.</p><div class="toolbar"><button type="button" class="btn btn-soft" data-action="cloud-reload-conflict">Cargar copia de la nube</button><button type="button" class="btn btn-danger" data-action="cloud-overwrite-conflict">Sobrescribir la nube conscientemente</button></div></div>`:''}</div></section>`;
  }
  const bmmRenderConfigBeforeCloudDataPanel=renderConfig;
  renderConfig=function(){return bmmRenderConfigBeforeCloudDataPanel()+bmmCloudDataPanel();};
  document.addEventListener('click',function(e){
    const el=e.target?.closest?.('[data-action]');if(!el)return;
    if(el.dataset.action==='cloud-save-from-settings'){e.preventDefault();bmmSaveCloudFromSettings();}
    else if(el.dataset.action==='cloud-load-from-settings'){e.preventDefault();bmmLoadCloudFromSettings();}
  });

  // v1.8.4: diagnóstico visible de fallos de conexión y persistencia.
  const BMM_DIAGNOSTICS_KEY='bmm-santa-cecilia-diagnostics-v1';
  function bmmDiagnosticCode(error, fallback='BMM-UNKNOWN'){
    const name=String(error?.name||'Error'),msg=String(error?.message||error||'Error desconocido');
    if(name==='QuotaExceededError') return 'BMM-LOCAL-QUOTA';
    if(name==='SecurityError') return 'BMM-LOCAL-SECURITY';
    if(/fetch|network|failed to fetch|load failed/i.test(msg)) return 'BMM-NETWORK';
    if(/401|sesión.*caducada/i.test(msg)) return 'BMM-AUTH-401';
    if(/403|permiso|despliegue/i.test(msg)) return 'BMM-DEPLOY-403';
    if(/413|tamaño máximo/i.test(msg)) return 'BMM-STATE-413';
    if(/409|conflict|conflicto/i.test(msg)) return 'BMM-CLOUD-CONFLICT';
    return fallback;
  }
  function bmmRecordDiagnostic(operation,error,extra={}){
    const item={at:new Date().toISOString(),code:extra.code||bmmDiagnosticCode(error),operation:String(operation||'operación desconocida'),
      message:String(error?.message||error||'Error desconocido').slice(0,500),name:String(error?.name||'Error'),
      endpoint:extra.endpoint||null,httpStatus:extra.httpStatus??null,context:extra.context||null};
    try{const old=JSON.parse(localStorage.getItem(BMM_DIAGNOSTICS_KEY)||'[]');const list=Array.isArray(old)?old:[];list.unshift(item);localStorage.setItem(BMM_DIAGNOSTICS_KEY,JSON.stringify(list.slice(0,30)));}catch(_){item.code='BMM-DIAGNOSTICS-STORAGE-FAILED';}
    window.__BMM_LAST_DIAGNOSTIC__=item;return item;
  }
  function bmmDiagnosticsPanel(){
    let items=[];try{const v=JSON.parse(localStorage.getItem(BMM_DIAGNOSTICS_KEY)||'[]');if(Array.isArray(v))items=v;}catch(_){}
    const safe=v=>String(v??'—').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    return `<section class="pro-card" style="margin-top:18px" id="bmm-diagnostics-panel"><div class="pro-card-head"><div><h2>Diagnóstico técnico</h2><p>Identifica la operación, el código, el endpoint y el estado HTTP de los errores. No guarda contraseñas ni cookies.</p></div><span class="pill">${items.length} registros</span></div><div class="pro-card-body"><div class="toolbar"><button class="btn btn-primary" type="button" data-action="diagnostics-copy">Copiar diagnóstico</button><button class="btn btn-soft" type="button" data-action="diagnostics-refresh">Actualizar</button><button class="btn btn-soft" type="button" data-action="diagnostics-clear">Borrar registros</button></div>${items.length?items.slice(0,10).map(x=>`<article style="border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0"><strong>${safe(x.code)} · ${safe(x.operation)}</strong><div style="font-size:12px;color:var(--muted);margin-top:4px">${safe(x.at)} · HTTP ${safe(x.httpStatus)} · ${safe(x.endpoint)}</div><p style="margin:6px 0 0;overflow-wrap:anywhere">${safe(x.message)}</p></article>`).join(''):'<p>No hay errores registrados. Vuelve a intentar guardar para capturar el siguiente fallo.</p>'}<p class="bmm-cloud-help">El registro se conserva en este navegador. Si falla, pulsa «Copiar diagnóstico» y envíame el texto.</p></div></section>`;
  }
  document.addEventListener('click',function(e){
    const el=e.target?.closest?.('[data-action^="diagnostics-"]');if(!el)return;
    const action=el.dataset.action;
    if(action==='diagnostics-open'){e.preventDefault();e.stopImmediatePropagation();if(page!=='configuracion'){page='configuracion';render();}setTimeout(()=>document.getElementById('bmm-diagnostics-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),80);return;}
    if(action==='diagnostics-refresh'){e.preventDefault();e.stopImmediatePropagation();render();return;}
    if(action==='diagnostics-clear'){e.preventDefault();e.stopImmediatePropagation();if(confirm('¿Borrar los diagnósticos guardados en este dispositivo?')){try{localStorage.removeItem(BMM_DIAGNOSTICS_KEY);}catch(_){}render();}return;}
    if(action==='diagnostics-copy'){e.preventDefault();e.stopImmediatePropagation();let value='';try{value=JSON.stringify(JSON.parse(localStorage.getItem(BMM_DIAGNOSTICS_KEY)||'[]'),null,2);}catch(_){value=JSON.stringify(window.__BMM_LAST_DIAGNOSTIC__||{},null,2);}if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>showToast('Diagnóstico copiado. Envíamelo para localizar el fallo.')).catch(()=>prompt('Copia este diagnóstico:',value));}else prompt('Copia este diagnóstico:',value);return;}
  },true);

  // ===== v1.7.6 Phase 1: recovery, local snapshots and race-safe cloud sync =====
  let bmmCloudEtag = null;
  let bmmCloudConflictEtag = null;
  let bmmRecoveryDownloaded = false;

  function bmmLocalSnapshots(){
    try{const value=JSON.parse(localStorage.getItem(BMM_LOCAL_BACKUPS_KEY)||'[]');return Array.isArray(value)?value.filter(x=>x&&x.state&&Array.isArray(x.state.events)&&Array.isArray(x.state.repertoire)):[];}catch(_){return [];}
  }
  function bmmSaveLocalSafetySnapshot(reason, value=state){
    try{
      const backups=bmmLocalSnapshots();
      backups.unshift({createdAt:new Date().toISOString(),reason:String(reason||'Antes de operación de datos'),state:clone(value)});
      const compact=backups.slice(0,3);
      localStorage.setItem(BMM_LOCAL_BACKUPS_KEY,JSON.stringify(compact));
      return true;
    }catch(error){
      try{
        const single=[{createdAt:new Date().toISOString(),reason:String(reason||'Antes de operación de datos'),state:clone(value)}];
        localStorage.setItem(BMM_LOCAL_BACKUPS_KEY,JSON.stringify(single));
        return true;
      }catch(error){bmmRecordDiagnostic('Crear copia de seguridad local',error,{code:error?.name==='QuotaExceededError'?'BMM-LOCAL-QUOTA':'BMM-LOCAL-BACKUP-FAILED',context:'localStorage backups key'});return false;}
    }
  }
  function bmmPersistCurrentState(){
    if(bmmHasUnresolvedLocalRecovery())throw new Error('El almacenamiento local anterior no se pudo leer. Descarga la recuperación antes de iniciar con datos base.');
    localStorage.setItem(STORE_KEY,JSON.stringify(state));
  }
  function bmmSnapshotPreviousLocalIfChanged(reason){
    if(bmmHasUnresolvedLocalRecovery())return false;
    try{
      const raw=localStorage.getItem(STORE_KEY);if(!raw)return true;
      const previous=JSON.parse(raw);
      if(!previous||!Array.isArray(previous.events)||!Array.isArray(previous.repertoire))return false;
      if(typeof bmmPayloadForComparison==='function'&&bmmPayloadForComparison(previous)!==bmmPayloadForComparison(state)){
        return bmmSaveLocalSafetySnapshot(reason||'Antes de guardar cambios',previous);
      }
      return true;
    }catch(error){bmmRecordDiagnostic('Comprobar copia local anterior',error,{code:'BMM-LOCAL-SNAPSHOT-CHECK',context:'localStorage STORE_KEY'});return false;}
  }
  function bmmDownloadLocalRecovery(){
    let record=bmmRecoveryRecord;
    try{record=record||JSON.parse(localStorage.getItem(BMM_RECOVERY_KEY)||'null');}catch(_){}
    if(!record||typeof record.rawOriginal!=='string'){showToast('No hay una recuperación local pendiente para descargar.',true);return false;}
    const payload=JSON.stringify({format:'BMM Santa Cecilia · recuperación del almacenamiento local',version:1,capturedAt:record.capturedAt,reason:record.reason,rawOriginal:record.rawOriginal},null,2);
    const blob=new Blob([payload],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`bmm-santa-cecilia-recuperacion-local-${bmmTodayKey()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    bmmRecoveryDownloaded=true;showToast('Copia de recuperación descargada. Se conserva también en el navegador si el almacenamiento lo permite.');return true;
  }
  function bmmUseBaseAfterRecovery(){
    if(!bmmHasUnresolvedLocalRecovery())return;
    if(!bmmRecoveryRecordStored&&!bmmRecoveryDownloaded){showToast('Primero descarga el archivo de recuperación; el navegador no ha podido conservar una segunda copia interna.',true);return;}
    if(!confirm('El almacenamiento local anterior no se puede interpretar. Se activará el catálogo base para poder continuar. El archivo original permanecerá en la recuperación descargable, pero los datos dañados no se fusionarán automáticamente. ¿Continuar?'))return;
    try{
      state=normalize(clone(SEED));
      localStorage.setItem(STORE_KEY,JSON.stringify(state));
      bmmLocalStoreDamaged=false;bmmLocalStorageReadFailed=false;bmmRecoveryResolved=true;bmmLocalHadValidStore=true;bmmCloudPending=!!(bmmCloudMode&&bmmAuthenticated);bmmDataStatusError=false;
      render();bmmUpdateDataStatusUI();showToast('Se han activado los datos base. La copia dañada se mantiene aparte para recuperación.');
    }catch(_){bmmLocalStoreDamaged=true;bmmRecoveryResolved=false;showToast('No se ha podido guardar el estado base. Los datos dañados no se han reemplazado.',true);}
  }
  function bmmRenderRecoveryBanner(){
    const root=document.getElementById('content');if(!root)return;
    root.querySelector('.bmm-recovery-banner')?.remove();
    const record=bmmRecoveryRecord;
    if((!record&&!bmmLocalStorageReadFailed)||bmmRecoveryBannerDismissed)return;
    const unresolved=bmmHasUnresolvedLocalRecovery();
    const hasRaw=typeof record?.rawOriginal==='string'&&record.rawOriginal.length>0;
    const banner=document.createElement('section');banner.className='bmm-recovery-banner'+(unresolved?' is-blocking':'');banner.setAttribute('role',unresolved?'alert':'status');
    const heading=bmmLocalStorageReadFailed?'No se ha podido leer el almacenamiento local':unresolved?'Se ha protegido un almacenamiento local ilegible':'Hay una copia local de recuperación disponible';
    const explanation=bmmLocalStorageReadFailed?'El navegador no permite leer su almacenamiento, por lo que la aplicación no guardará datos para evitar sobrescribir una copia que no puede comprobar. Prueba a abrir la aplicación desde Chrome en HTTPS o carga una copia válida desde Ajustes.':unresolved?'La aplicación no escribirá encima de los datos dañados. Descarga el archivo original y después puedes cargar los datos desde la nube o confirmar el inicio con el catálogo base.':'Se conserva una copia bruta de un almacenamiento local anterior que no pudo leerse. Descárgala por si contiene información recuperable.';
    banner.innerHTML=`<div class="bmm-recovery-banner-head"><strong>${esc(heading)}</strong>${!unresolved?'<button type="button" class="btn btn-soft btn-small" data-bmm-recovery-action="dismiss">Ocultar aviso</button>':''}</div><p>${esc(explanation)}</p><div class="toolbar">${hasRaw?'<button type="button" class="btn btn-primary" data-bmm-recovery-action="download">Descargar recuperación</button>':''}${unresolved&&record?.rawOriginal!==null?'<button type="button" class="btn btn-danger" data-bmm-recovery-action="base">Continuar con datos base</button>':''}</div>`;
    root.prepend(banner);
  }
  const bmmRenderBeforeRecoveryBanner=render;
  render=function(){const result=bmmRenderBeforeRecoveryBanner();bmmRenderRecoveryBanner();return result;};

  // A real local/cloud mismatch is a conflict. Legacy rows that differ only by synthesized IDs are reconciled safely below.
  bmmLoadCloud=async function(){
    bmmCloudAutoCompletionPending=0;
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
    try{
      const r=await fetch('/.netlify/functions/state',{credentials:'same-origin',signal:controller.signal,cache:'no-store'});
      const data=await r.json().catch(()=>({}));
      if(r.status===401||!r.ok)return false;
      bmmAuthenticated=true;bmmCloudMode=true;bmmCloudEtag=data.etag||null;bmmCloudConflictEtag=null;
      if(!data.state){bmmCloudPending=true;bmmUpdateDataStatusUI();return true;}
      if(!Array.isArray(data.state.events)||!Array.isArray(data.state.repertoire))return false;
      const remoteAutoCompletionCount=bmmCountOverdueIncomplete(data.state.events);
      const remote=normalize(data.state);
      const localUsable=bmmLocalHadValidStore&&!bmmLocalStoreDamaged;
      const samePayload=localUsable&&bmmPayloadForComparison(state)===bmmPayloadForComparison(remote);
      const sameAfterLegacyIdNormalization=localUsable&&!samePayload&&bmmEquivalentAfterLegacyIdNormalization(state,remote,data.state);
      if(localUsable&&!samePayload&&!sameAfterLegacyIdNormalization){
        // A content mismatch is not necessarily a concurrent cloud conflict. If the local
        // snapshot still carries the same last-acknowledged cloud timestamp as the current
        // remote revision, local edits are pending on that same base. Preserve them, adopt
        // the freshly-read ETag and do one guarded sync. Real newer remote revisions still conflict.
        if(data.etag && bmmSameCloudBaseRevision(state,remote)){
          bmmCloudEtag=data.etag;
          bmmCloudConflictState=null;bmmCloudConflictEtag=null;
          bmmCloudPending=true;bmmCloudAutoCompletionPending=0;bmmCloudStartupSyncNeeded=true;bmmDataStatusError=false;
          bmmUpdateDataStatusUI();
          return true;
        }
        bmmCloudConflictState=remote;bmmCloudConflictEtag=data.etag||null;bmmCloudPending=true;bmmDataStatusError=false;
        bmmUpdateDataStatusUI();
        return true;
      }
      if(bmmHasUnresolvedLocalRecovery()){
        // Even if a separate recovery record was stored, only an explicit action
        // may replace the damaged local slot with the remote copy.
        bmmCloudConflictState=remote;bmmCloudConflictEtag=data.etag||null;bmmCloudPending=true;bmmDataStatusError=false;
        showToast('Se ha conservado el almacenamiento local dañado. Revisa o descarga la recuperación y carga la nube desde Ajustes cuando estés preparado.',true);
        bmmUpdateDataStatusUI();return true;
      }
      if(!samePayload)bmmSaveLocalSafetySnapshot('Antes de cargar datos de nube al iniciar');
      state=remote;
      try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}
      catch(_){bmmDataStatusError=true;showToast('Se ha leído la nube, pero el navegador no permite guardar la copia local. Exporta los datos antes de cerrar.',true);return false;}
      bmmLocalStoreDamaged=false;bmmLocalStorageReadFailed=false;bmmRecoveryResolved=true;bmmLocalHadValidStore=true;bmmCloudAutoCompletionPending=remoteAutoCompletionCount;bmmCloudPending=remoteAutoCompletionCount>0;bmmCloudConflictState=null;bmmCloudConflictEtag=null;bmmDataStatusError=false;
      bmmUpdateDataStatusUI();return true;
    }catch(_){return false;}finally{clearTimeout(timer);}
  };

  // Cloud writes use the last known server ETag. The function also checks for edits
  // made while the request is in flight and schedules a follow-up only after success.
  bmmSyncNow=async function(){
    if(bmmHasUnresolvedLocalRecovery()){showToast('Sincronización pausada: primero recupera los datos locales o carga una copia válida de la nube.',true);bmmUpdateDataStatusUI();return false;}
    if(!bmmCloudMode||!bmmAuthenticated){bmmUpdateDataStatusUI();showToast('La nube solo está disponible después de iniciar sesión en Netlify.',true);return false;}
    if(bmmCloudConflictState&&!bmmForceCloudOverwrite){bmmUpdateDataStatusUI();showToast('Resuelve el conflicto en Ajustes antes de volver a sincronizar.',true);return false;}
    if(bmmSyncBusy){bmmCloudQueued=true;return false;}
    bmmSyncBusy=true;bmmDataStatusError=false;bmmUpdateDataStatusUI();
    let syncHttpStatus=null, syncServerCode=null;
    const snapshot=clone(state);const forced=bmmForceCloudOverwrite===true;let followUpRequired=false;
    const expectedEtag=(forced&&bmmCloudConflictEtag)?bmmCloudConflictEtag:bmmCloudEtag;
    try{
      let r=await fetch('/.netlify/functions/state',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,expectedCloudEtag:expectedEtag||null,expectedCloudUpdatedAt:snapshot.cloudUpdatedAt||null,force:forced})});
      syncHttpStatus=r.status;
      let body=await r.json().catch(()=>({}));
      syncServerCode=body.code||null;
      if(r.status===409&&body.conflict){
        const rawRemote=body.state&&Array.isArray(body.state.events)&&Array.isArray(body.state.repertoire)?body.state:null;
        const remote=rawRemote?normalize(rawRemote):null;
        // A prior POST may have committed despite a lost response, or a legacy
        // cloud row may differ only by IDs synthesized by normalization. In either
        // case, reconcile the ETag without writing or raising a false conflict.
        const payloadAlreadyCurrent=!!remote&&bmmPayloadForComparison(remote)===bmmPayloadForComparison(snapshot);
        const legacyIdsOnly=!!remote&&!payloadAlreadyCurrent&&bmmEquivalentAfterLegacyIdNormalization(snapshot,remote,rawRemote);
        if(remote&&body.etag&&(payloadAlreadyCurrent||legacyIdsOnly)){
          state=remote;bmmCloudEtag=body.etag;bmmCloudConflictEtag=null;bmmCloudConflictState=null;bmmCloudPending=false;bmmAutoSyncWhenOnline=false;bmmOnlineRetryCount=0;
          bmmCloudLastSavedAt=state.cloudUpdatedAt||null;
          try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(_){bmmDataStatusError=true;throw new Error('La nube coincide con los datos locales, pero no se pudo actualizar la marca local. Descarga una copia JSON.');}
          bmmDataStatusError=false;bmmUpdateDataStatusUI();showToast(legacyIdsOnly?'Se ha reconciliado una diferencia técnica de registros antiguos sin sobrescribir la nube.':'La nube ya contiene estos datos; se ha reconciliado la versión sin volver a escribir.');return true;
        }
        // If only the ETag moved but the acknowledged timestamp is unchanged, retry
        // exactly once against the fresh ETag. Netlify still does the conditional write,
        // and still creates/verifies its recoverable pre-write backup before replacing state.
        if(remote&&body.etag&&!forced&&bmmSameCloudBaseRevision(snapshot,remote)){
          r=await fetch('/.netlify/functions/state',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:snapshot,expectedCloudEtag:body.etag,expectedCloudUpdatedAt:remote.cloudUpdatedAt||null,force:false})});
          syncHttpStatus=r.status;
          body=await r.json().catch(()=>({}));
          syncServerCode=body.code||null;
          if(r.status===409&&body.conflict){
            const retryRemote=body.state&&Array.isArray(body.state.events)&&Array.isArray(body.state.repertoire)?normalize(body.state):null;
            bmmCloudConflictState=retryRemote||(body.conflict?{events:[],repertoire:[],categories:[],__cloudMissing:true}:null);bmmCloudConflictEtag=body.etag||null;bmmCloudEtag=body.etag||null;bmmCloudPending=true;bmmAutoSyncWhenOnline=false;bmmDataStatusError=false;bmmUpdateDataStatusUI();
            if(page==='configuracion')render();showToast('La nube volvió a cambiar durante el reintento seguro. No se ha sobrescrito; revisa Ajustes.',true);return false;
          }
          if(!r.ok)throw new Error(body.error||`El reintento seguro respondió HTTP ${r.status}.`);
          if(!body.etag)throw new Error('El reintento seguro no devolvió una versión de nube verificable.');
        }else{
          bmmCloudConflictState=remote||(body.conflict?{events:[],repertoire:[],categories:[],__cloudMissing:true}:null);bmmCloudConflictEtag=body.etag||null;bmmCloudEtag=body.etag||null;bmmCloudPending=true;bmmAutoSyncWhenOnline=false;bmmDataStatusError=false;bmmUpdateDataStatusUI();
          if(page==='configuracion')render();showToast('La nube contiene una versión realmente posterior a la última base de este dispositivo. No se ha sobrescrito; revisa Ajustes.',true);return false;
        }
      }
      if(!r.ok)throw new Error([r.status===401?'La sesión de Netlify ha caducado. Inicia sesión de nuevo.':(body.error||'No se ha podido guardar en la nube.'),body.code,body.detail,body.attempts?('intentos: '+body.attempts):null].filter(Boolean).join(' · '));
      if(!body.etag)throw new Error('Netlify no ha devuelto la versión del guardado. No se puede confirmar la sincronización; vuelve a intentarlo.');
      const savedAt=body.savedAt||state.cloudUpdatedAt||new Date().toISOString();
      state.cloudUpdatedAt=savedAt;state.cloudUpdatedBy='BMM';bmmCloudLastSavedAt=savedAt;bmmCloudEtag=body.etag;bmmCloudConflictEtag=null;bmmLocalHadValidStore=true;bmmCloudBackups=null;
      try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}
      catch(err){throw new Error('La nube se guardó, pero no se pudo actualizar la copia local. Descarga un JSON de seguridad.');}
      const editedDuringSync=bmmPayloadForComparison(state)!==bmmPayloadForComparison(snapshot);
      bmmCloudPending=editedDuringSync;followUpRequired=editedDuringSync;bmmDataStatusError=false;bmmCloudConflictState=null;
      bmmUpdateDataStatusUI();
      if(!editedDuringSync){bmmFlashSaveState('Guardado');showToast('Datos guardados localmente y sincronizados con Netlify');}
      return true;
    }catch(err){bmmRecordDiagnostic('Sincronización en la nube',err,{code:syncServerCode||undefined,httpStatus:syncHttpStatus,endpoint:'/.netlify/functions/state',context:'POST state.json'});bmmDataStatusError=true;bmmCloudPending=true;bmmUpdateDataStatusUI();showToast(err.message||'Error de sincronización. La copia local se mantiene.',true);return false;}
    finally{bmmSyncBusy=false;bmmUpdateDataStatusUI();try{bmmRefreshSidebarAdmin();}catch(_){}const queued=bmmCloudQueued||followUpRequired;bmmCloudQueued=false;if(bmmSyncTimer)clearTimeout(bmmSyncTimer);bmmSyncTimer=null;if(queued&&!bmmCloudConflictState)bmmSyncTimer=setTimeout(()=>bmmSyncNow(),500);if(page==='configuracion')render();}
  };
  let bmmAutoSyncWhenOnline=false,bmmOnlineRetryCount=0,bmmOnlineRetryTimer=null;
  bmmDebouncedCloud=function(){if(bmmHasUnresolvedLocalRecovery()||!bmmCloudMode||!bmmAuthenticated||bmmCloudConflictState)return;bmmAutoSyncWhenOnline=true;if(bmmSyncTimer)clearTimeout(bmmSyncTimer);bmmSyncTimer=setTimeout(()=>bmmSyncNow(),900);};
  bmmScheduleCloudSave=function(){bmmDebouncedCloud();};
  window.addEventListener('online',()=>{
    if(!bmmAutoSyncWhenOnline||!bmmCloudPending||!bmmCloudMode||!bmmAuthenticated||bmmCloudConflictState||bmmHasUnresolvedLocalRecovery()||bmmOnlineRetryCount>=3)return;
    if(bmmOnlineRetryTimer)clearTimeout(bmmOnlineRetryTimer);
    bmmOnlineRetryCount++;
    bmmOnlineRetryTimer=setTimeout(()=>{if(bmmAutoSyncWhenOnline&&!bmmCloudConflictState)bmmSyncNow();},900);
  });

  // Guard every mutation without bypassing the existing audit/save pipeline.
  const bmmSaveBeforePhase1Final=save;
  save=function(msg='Cambios guardados'){
    if(bmmHasUnresolvedLocalRecovery()){showToast('Guardado pausado para proteger la copia local dañada. Descarga su recuperación o carga una copia válida desde Ajustes.',true);bmmUpdateDataStatusUI();return false;}
    const hadPreviousSnapshot=bmmSnapshotPreviousLocalIfChanged('Antes del guardado local');
    if(!hadPreviousSnapshot){showToast('Guardado cancelado para proteger los datos anteriores: no se pudo crear una copia local de seguridad. Descarga un JSON desde Ajustes y vuelve a intentarlo.',true);bmmUpdateDataStatusUI();return false;}
    const result=bmmSaveBeforePhase1Final(msg);
    if(result!==false)bmmLocalHadValidStore=true;
    bmmUpdateDataStatusUI();
    return result;
  };
  bmmSaveCloudFromSettings=async function(){
    if(bmmHasUnresolvedLocalRecovery()){showToast('El guardado está pausado hasta resolver la recuperación local.',true);return false;}
    if(bmmFormDirty){showToast('Hay un formulario con cambios sin confirmar. Pulsa Guardar dentro del formulario antes de sincronizar.',true);return false;}
    if(!bmmCloudMode||!bmmAuthenticated){showToast('Inicia sesión en Netlify para sincronizar con la nube. Los datos locales no se han borrado.',true);return false;}
    const snapshotOK=bmmSnapshotPreviousLocalIfChanged('Antes de guardar y sincronizar desde Ajustes');
    if(!snapshotOK){bmmRecordDiagnostic('Preparar sincronización: copia previa',new Error('No se pudo crear la copia de seguridad local antes de sincronizar.'),{code:'BMM-LOCAL-BACKUP-FAILED',context:'bmmSnapshotPreviousLocalIfChanged'});showToast('No se ha podido conservar una copia local previa. Abre Ajustes > Diagnóstico técnico para ver el código; no se ha iniciado la sincronización.',true);return false;}
    try{localStorage.setItem(STORE_KEY,JSON.stringify(state));bmmLocalHadValidStore=true;bmmCloudPending=true;bmmDataStatusError=false;}
    catch(_){showToast('No se pudo guardar la copia local. Exporta un JSON antes de continuar.',true);return false;}
    bmmUpdateDataStatusUI();return await bmmSyncNow();
  };
  bmmLoadCloudFromSettings=async function(){
    if(!bmmCloudMode||!bmmAuthenticated){showToast('Inicia sesión en Netlify para cargar los datos compartidos.',true);return false;}
    if(bmmFormDirty){showToast('Hay un formulario con cambios sin confirmar. Guarda o descarta el formulario antes de cargar la nube.',true);return false;}
    if(!confirm('Se reemplazarán los datos abiertos por la última copia de la nube. Se guardará una copia local interna y se descargará un JSON de seguridad. ¿Continuar?'))return false;
    if(bmmHasUnresolvedLocalRecovery()&&!bmmRecoveryRecordStored&&!bmmRecoveryDownloaded){showToast('Descarga primero el archivo de recuperación local; el navegador no pudo conservar una copia interna.',true);return false;}
    const snapshotOK=bmmSaveLocalSafetySnapshot('Antes de cargar manualmente la copia de nube');
    if(!bmmDownloadBackupBeforePhase1('antes-de-cargar-nube'))return false;
    if(!snapshotOK)showToast('No se pudo crear la copia interna adicional; la descarga JSON se ha iniciado. Comprueba que el archivo se haya guardado.',true);
    bmmDataStatusError=false;bmmUpdateDataStatusUI();
    let r,body;
    try{r=await fetch('/.netlify/functions/state',{method:'GET',credentials:'same-origin',cache:'no-store'});body=await r.json().catch(()=>({}));}
    catch(_){bmmDataStatusError=true;bmmUpdateDataStatusUI();showToast('No se pudo contactar con Netlify. Se han conservado los datos actuales.',true);return false;}
    if(r.status===401||!r.ok){bmmDataStatusError=true;bmmUpdateDataStatusUI();showToast(body.error||'No se ha podido cargar la nube. Comprueba la sesión.',true);return false;}
    if(!body.state||!Array.isArray(body.state.events)||!Array.isArray(body.state.repertoire)){showToast('La nube todavía no contiene una copia válida. No se han cambiado los datos locales.',true);return false;}
    const remoteAutoCompletionCount=bmmCountOverdueIncomplete(body.state.events);
    const remote=normalize(body.state);
    try{localStorage.setItem(STORE_KEY,JSON.stringify(remote));}
    catch(_){download(`bmm-santa-cecilia-copia-nube-recibida-${bmmTodayKey()}.json`,JSON.stringify(remote,null,2),'application/json;charset=utf-8');bmmDataStatusError=true;bmmUpdateDataStatusUI();showToast('No se pudo guardar la copia remota localmente. Se ha descargado un JSON con la copia de nube; los datos activos no se han cambiado.',true);return false;}
    state=remote;bmmCloudEtag=body.etag||null;bmmCloudConflictEtag=null;bmmCloudConflictState=null;bmmAutoSyncWhenOnline=false;bmmLocalStoreDamaged=false;bmmLocalStorageReadFailed=false;bmmRecoveryResolved=true;bmmLocalHadValidStore=true;bmmFormDirty=false;bmmCloudPending=false;bmmDataStatusError=false;bmmCloudBackups=null;
    render();bmmUpdateDataStatusUI();
    if(remoteAutoCompletionCount>0){
      bmmCloudPending=true;bmmUpdateDataStatusUI();
      const saved=await save(`Actuaciones completadas automáticamente por fecha (${remoteAutoCompletionCount})`);
      if(saved!==false){
        if(bmmSyncTimer){clearTimeout(bmmSyncTimer);bmmSyncTimer=null;}
        const synced=await bmmSyncNow();
        if(synced)showToast(`Copia cargada; ${remoteAutoCompletionCount} actuación${remoteAutoCompletionCount===1?'':'es'} anterior${remoteAutoCompletionCount===1?'':'es'} completada${remoteAutoCompletionCount===1?'':'s'} y sincronizada${remoteAutoCompletionCount===1?'':'s'}.`);
        else showToast('Los datos completados están guardados localmente, pero la nube no confirmó la sincronización. Revisa el estado antes de cerrar.',true);
        return true;
      }
      showToast('La copia se ha cargado localmente, pero no se han podido guardar las finalizaciones automáticas.',true);return true;
    }
    showToast('Copia de la nube cargada. La nube no se ha modificado.');return true;
  };

  // Resolve a conflict by adopting the exact remote version without sending a POST.
  document.addEventListener('click',function(e){
    const button=e.target?.closest?.('[data-bmm-recovery-action]');
    if(button){e.preventDefault();const action=button.dataset.bmmRecoveryAction;if(action==='download')bmmDownloadLocalRecovery();else if(action==='base')bmmUseBaseAfterRecovery();else if(action==='dismiss'){bmmRecoveryBannerDismissed=true;render();}return;}
  },true);
  document.addEventListener('click',function(e){
    const el=e.target?.closest?.('[data-action]');if(!el)return;
    if(el.dataset.action==='cloud-load-from-settings'){e.preventDefault();e.stopImmediatePropagation();bmmLoadCloudFromSettings();return;}
    if(el.dataset.action==='cloud-reload-conflict'){
      e.preventDefault();e.stopImmediatePropagation();
      if(!bmmCloudConflictState){showToast('No hay ningún conflicto pendiente.',true);return;}
      if(!confirm('Se reemplazará la copia local por la versión de nube que se detectó en el conflicto. Antes se guardará una copia interna y se descargará un JSON. ¿Continuar?'))return;
      if(bmmLocalStoreDamaged&&!bmmRecoveryRecordStored&&!bmmRecoveryDownloaded){showToast('Descarga primero la recuperación local antes de reemplazar los datos activos.',true);return;}
      bmmSaveLocalSafetySnapshot('Antes de cargar nube tras conflicto');
      bmmDownloadBackupBeforePhase1('antes-de-resolver-conflicto');
      const remote=normalize(bmmCloudConflictState);
      try{localStorage.setItem(STORE_KEY,JSON.stringify(remote));}catch(_){showToast('No se pudo guardar la copia remota localmente. La versión activa no se ha reemplazado.',true);return;}
      state=remote;bmmCloudEtag=bmmCloudConflictEtag;bmmCloudConflictState=null;bmmCloudConflictEtag=null;bmmAutoSyncWhenOnline=false;bmmCloudPending=false;bmmDataStatusError=false;bmmLocalStoreDamaged=false;bmmRecoveryResolved=true;bmmLocalHadValidStore=true;
      render();bmmUpdateDataStatusUI();showToast('Versión de nube cargada localmente. No se ha vuelto a escribir en la nube.');return;
    }
    if(el.dataset.action==='cloud-overwrite-conflict'){
      e.preventDefault();e.stopImmediatePropagation();
      if(!bmmCloudConflictState){showToast('No hay ningún conflicto pendiente.',true);return;}
      if(!confirm('Vas a sobrescribir la versión de nube que se mostró en el conflicto con los datos locales. La escritura fallará de forma segura si otra persona vuelve a guardar antes que tú. ¿Continuar?'))return;
      bmmForceCloudOverwrite=true;bmmSyncNow().finally(()=>{bmmForceCloudOverwrite=false;});return;
    }
    if(el.dataset.action==='save-now'&&bmmHasUnresolvedLocalRecovery()){
      e.preventDefault();e.stopImmediatePropagation();showToast('Guardado pausado para no sobrescribir datos locales dañados. Usa las opciones del aviso superior.',true);return;
    }
  },true);

  function bmmRestoreLatestLocalSnapshot(){
    const backups=bmmLocalSnapshots();if(!backups.length){showToast('No hay copias locales internas disponibles.',true);return;}
    const latest=backups[0];if(!confirm(`Se restaurará la copia local del ${new Date(latest.createdAt).toLocaleString('es-ES')} (${latest.reason||'sin descripción'}). La versión activa se guardará antes si es posible. ¿Continuar?`))return;
    bmmSaveLocalSafetySnapshot('Antes de restaurar otra copia local');
    const restored=normalize(latest.state);
    try{localStorage.setItem(STORE_KEY,JSON.stringify(restored));}catch(_){showToast('No se pudo guardar la copia restaurada; los datos activos no se han cambiado.',true);return;}
    state=restored;bmmAutoSyncWhenOnline=false;bmmLocalStoreDamaged=false;bmmRecoveryResolved=true;bmmLocalHadValidStore=true;bmmCloudPending=!!(bmmCloudMode&&bmmAuthenticated);bmmDataStatusError=false;
    if(bmmCloudMode&&bmmAuthenticated)showToast('Copia local restaurada. No se ha sincronizado todavía; revisa los datos y pulsa Guardar y sincronizar cuando estés seguro.');
    else showToast('Copia local restaurada.');
    render();bmmUpdateDataStatusUI();
  }
  function bmmDownloadLatestLocalSnapshot(){
    const backups=bmmLocalSnapshots();if(!backups.length){showToast('No hay copias locales internas disponibles.',true);return;}
    download(`bmm-santa-cecilia-copia-local-${bmmTodayKey()}.json`,JSON.stringify(backups[0],null,2),'application/json;charset=utf-8');showToast('Copia local interna descargada.');
  }
  const bmmHandleActionBeforeLocalBackups=handleAction;
  handleAction=function(el){const action=el?.dataset?.action;if(action==='backup-restore-latest'){bmmRestoreLatestLocalSnapshot();return;}if(action==='backup-download-latest'){bmmDownloadLatestLocalSnapshot();return;}return bmmHandleActionBeforeLocalBackups(el);};
  let bmmCloudBackups=null,bmmCloudBackupsLoading=false,bmmCloudBackupsError='';
  async function bmmEnsureCloudBackupsLoaded(force=false){
    if(!bmmCloudMode||!bmmAuthenticated){bmmCloudBackups=[];return;}
    if(bmmCloudBackupsLoading||(!force&&Array.isArray(bmmCloudBackups)))return;
    bmmCloudBackupsLoading=true;bmmCloudBackupsError='';
    try{const r=await fetch('/.netlify/functions/state?backups=1',{credentials:'same-origin',cache:'no-store'});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'No se pudieron consultar las copias de nube.');bmmCloudBackups=Array.isArray(body.backups)?body.backups:[];}
    catch(err){bmmCloudBackupsError=err.message||'Error de lectura de copias de nube.';bmmCloudBackups=null;}
    finally{bmmCloudBackupsLoading=false;if(page==='configuracion')render();}
  }
  function bmmCloudBackupPanel(){
    if(!bmmCloudMode||!bmmAuthenticated)return `<section class="pro-card bmm-cloud-backups-panel" style="margin-top:18px"><div class="pro-card-head"><div><h2>Versiones anteriores de la nube</h2><p>Inicia sesión para consultar los puntos de recuperación compartidos.</p></div></div></section>`;
    if(!Array.isArray(bmmCloudBackups)&&!bmmCloudBackupsLoading&&!bmmCloudBackupsError)bmmEnsureCloudBackupsLoaded();
    const list=Array.isArray(bmmCloudBackups)?bmmCloudBackups:[];
    const rows=list.map(item=>`<article class="bmm-cloud-backup-row"><div><strong>${esc(item.createdAt?new Date(item.createdAt).toLocaleString('es-ES'):'Copia anterior')}</strong><small>Versión previa conservada automáticamente antes de guardar</small></div><button type="button" class="btn btn-soft btn-small" data-action="cloud-backup-restore" data-backup-key="${esc(item.key)}">Cargar en este dispositivo</button></article>`).join('');
    return `<section class="pro-card bmm-cloud-backups-panel" style="margin-top:18px"><div class="pro-card-head"><div><h2>Versiones anteriores de la nube</h2><p>Se conservan hasta ocho copias previas en Netlify Blobs antes de reemplazar los datos compartidos.</p></div><button type="button" class="btn btn-soft btn-small" data-action="cloud-backups-refresh">Actualizar</button></div><div class="pro-card-body">${bmmCloudBackupsLoading?'<p>Consultando copias guardadas…</p>':bmmCloudBackupsError?`<p class="bmm-backup-error">${esc(bmmCloudBackupsError)}</p>`:rows||'<p>Aún no hay copias previas. Se creará la primera cuando se guarde un cambio real en la nube.</p>'}<p class="bmm-cloud-help">«Cargar en este dispositivo» restaura la copia seleccionada solo localmente. Después de revisar el repertorio y las actuaciones, usa «Guardar y sincronizar ahora» para publicar esa versión. La nube no se modifica automáticamente al seleccionar una copia.</p></div></section>`;
  }
  const bmmRenderConfigBeforePhase1Backups=renderConfig;
  renderConfig=function(){
    const base=bmmRenderConfigBeforePhase1Backups();const backups=bmmLocalSnapshots();const latest=backups[0];
    const backupPanel=`<section class="pro-card bmm-local-backup-panel" style="margin-top:18px"><div class="pro-card-head"><div><h2>Copias de seguridad locales</h2><p>Se mantienen hasta tres puntos de recuperación antes de operaciones importantes, cuando el almacenamiento del navegador lo permite.</p></div><span class="audit-badge">${backups.length} copia${backups.length===1?'':'s'}</span></div><div class="pro-card-body"><p class="bmm-backup-latest">${latest?'Última copia: '+esc(new Date(latest.createdAt).toLocaleString('es-ES'))+' · '+esc(latest.reason||'Copia automática'):'Todavía no hay puntos de recuperación guardados.'}</p><div class="toolbar"><button type="button" class="btn btn-soft" data-action="backup-download-latest" ${backups.length?'':'disabled'}>Descargar última copia</button><button type="button" class="btn btn-soft" data-action="backup-restore-latest" ${backups.length?'':'disabled'}>Restaurar última copia</button></div><p class="bmm-cloud-help">Estas copias están en el almacenamiento local de este navegador; no sustituyen una exportación JSON externa ni se comparten automáticamente con otros dispositivos.</p></div></section>`;
    return base+backupPanel+bmmCloudBackupPanel()+bmmDiagnosticsPanel();
  };

  async function bmmRestoreCloudBackupLocally(key){
    if(!bmmCloudMode||!bmmAuthenticated){showToast('Inicia sesión en Netlify para recuperar una copia compartida.',true);return;}
    if(bmmFormDirty){showToast('Guarda o descarta el formulario abierto antes de restaurar una copia.',true);return;}
    if(bmmLocalStoreDamaged&&!bmmRecoveryRecordStored&&!bmmRecoveryDownloaded){showToast('Descarga primero la recuperación del almacenamiento local dañado.',true);return;}
    if(!/^backups\/\d{13}-[a-f0-9]+\.json$/.test(String(key||''))){showToast('La copia seleccionada no tiene un identificador válido.',true);return;}
    if(!confirm('Se cargará esta versión anterior solo en este dispositivo. La nube no cambiará hasta que revises los datos y pulses Guardar y sincronizar. Se guardará antes una copia local. ¿Continuar?'))return;
    bmmSaveLocalSafetySnapshot('Antes de cargar una versión anterior de nube');
    bmmDownloadBackupBeforePhase1('antes-de-restaurar-copia-nube');
    let r,body;try{r=await fetch('/.netlify/functions/state?backup='+encodeURIComponent(key),{credentials:'same-origin',cache:'no-store'});body=await r.json().catch(()=>({}));}catch(_){showToast('No se pudo descargar la copia anterior. Los datos activos se mantienen.',true);return;}
    if(!r.ok||!body.state||!Array.isArray(body.state.events)||!Array.isArray(body.state.repertoire)){showToast(body.error||'La copia anterior no está disponible o no es válida.',true);return;}
    const restored=normalize(body.state);
    try{localStorage.setItem(STORE_KEY,JSON.stringify(restored));}
    catch(_){download(`bmm-santa-cecilia-restauracion-cloud-${bmmTodayKey()}.json`,JSON.stringify(restored,null,2),'application/json;charset=utf-8');showToast('No se pudo guardar localmente. La copia anterior se ha descargado como JSON y los datos activos se mantienen.',true);return;}
    state=restored;bmmCloudEtag=body.currentEtag||bmmCloudEtag;bmmAutoSyncWhenOnline=false;bmmCloudConflictState=null;bmmCloudConflictEtag=null;bmmLocalStoreDamaged=false;bmmLocalStorageReadFailed=false;bmmRecoveryResolved=true;bmmLocalHadValidStore=true;bmmCloudPending=true;bmmDataStatusError=false;bmmCloudBackups=null;
    render();bmmUpdateDataStatusUI();showToast('Versión anterior cargada localmente. Revísala y sincronízala solo cuando estés seguro.');
  }

  // Snapshot before manual exports and key destructive actions; never autoload over dirty local state.
  const bmmDownloadBackupBeforePhase1=bmmDownloadBackup;
  bmmDownloadBackup=function(reason='manual'){bmmSaveLocalSafetySnapshot('Descarga de seguridad: '+reason);return bmmDownloadBackupBeforePhase1(reason);};

  // Data status explicitly reflects recovery pauses and local-only snapshots.
  const bmmGetDataStatusBeforeRecovery=bmmGetDataStatus;
  bmmGetDataStatus=function(){if(bmmHasUnresolvedLocalRecovery())return {key:'error',label:'Recuperación local pendiente',detail:'No se guardarán datos hasta conservar el original o confirmar el inicio con datos base.'};return bmmGetDataStatusBeforeRecovery();};

  // The floating/manual save has its own legacy handler and bypasses save().
  // Intercept it fully so recovery, local durability and cloud sync follow one safe path.
  document.addEventListener('click',function(e){
    const el=e.target?.closest?.('[data-action="save-now"]');if(!el)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(bmmHasUnresolvedLocalRecovery()){
      showToast('Guardado cancelado: primero descarga la recuperación o carga una copia válida desde Ajustes.',true);
      bmmUpdateDataStatusUI();return;
    }
    if(bmmFormDirty){
      showToast('Hay un formulario con cambios sin confirmar. Guarda el propio formulario antes de usar el guardado general.',true);
      bmmUpdateDataStatusUI();return;
    }
    if(!bmmSnapshotPreviousLocalIfChanged('Antes del guardado manual')){
      showToast('Guardado cancelado para proteger los datos anteriores. Descarga un JSON desde Ajustes y vuelve a intentarlo.',true);
      bmmUpdateDataStatusUI();return;
    }
    try{
      bmmAddAudit('Guardado manual solicitado','Guardado');
      localStorage.setItem(STORE_KEY,JSON.stringify(state));
      bmmLocalHadValidStore=true;bmmDataStatusError=false;bmmCloudPending=!!(bmmCloudMode&&bmmAuthenticated);
      bmmFlashSaveState('Guardado');showToast('Cambios guardados en este dispositivo');
      bmmUpdateDataStatusUI();render();
    }catch(_){
      bmmDataStatusError=true;bmmUpdateDataStatusUI();
      showToast('No se pudo guardar localmente. La sincronización se ha cancelado para no enviar cambios sin copia local. Descarga un JSON y libera espacio antes de reintentar.',true);
      return;
    }
    if(bmmCloudMode&&bmmAuthenticated){
      bmmFlashSaveState('Sincronizando…',8000);
      bmmSyncNow().then(ok=>bmmFlashSaveState(ok?'Guardado':'Reintentar')).catch(()=>bmmFlashSaveState('Reintentar'));
    }
  },true);
  // New actions are handled directly (rather than going through a nested save handler).
  document.addEventListener('click',function(e){const el=e.target?.closest?.('[data-action]');if(!el)return;if(el.dataset.action==='backup-restore-latest'){e.preventDefault();e.stopImmediatePropagation();bmmRestoreLatestLocalSnapshot();}else if(el.dataset.action==='backup-download-latest'){e.preventDefault();e.stopImmediatePropagation();bmmDownloadLatestLocalSnapshot();}},true);

  document.addEventListener('click',function(e){
    const el=e.target?.closest?.('[data-action]');if(!el)return;
    if(el.dataset.action==='cloud-backups-refresh'){e.preventDefault();e.stopImmediatePropagation();bmmCloudBackups=null;bmmEnsureCloudBackupsLoaded(true);return;}
    if(el.dataset.action==='cloud-backup-restore'){e.preventDefault();e.stopImmediatePropagation();bmmRestoreCloudBackupLocally(el.dataset.backupKey||'');return;}
  },true);

  // Once an event's date is behind the local calendar day, complete it in the
  // data model and run it through the normal guarded save/audit/cloud pipeline.
  function bmmRunAutomaticCompletionCheck(){
    if(!Array.isArray(state?.events)||bmmFormDirty||bmmHasUnresolvedLocalRecovery())return 0;
    const today=bmmTodayKey();
    const overdue=state.events.filter(event=>event&&event.date&&String(event.date)<today&&!bmmStatusIsCancelled(event.status)&&!bmmStatusIsCompleted(event.status));
    if(!overdue.length)return 0;
    const previous=overdue.map(event=>({event,status:event.status}));
    overdue.forEach(event=>{event.status='Realizado';});
    const saved=save(`Actuaciones completadas automáticamente por fecha (${overdue.length})`);
    if(saved===false){previous.forEach(item=>{item.event.status=item.status;});render();bmmUpdateDataStatusUI();return 0;}
    bmmCloudPending=!!(bmmCloudMode&&bmmAuthenticated);
    bmmUpdateDataStatusUI();
    return overdue.length;
  }
  window.bmmRunAutomaticCompletionCheck=bmmRunAutomaticCompletionCheck;
  const bmmCloseModalBeforeAutoCompletion=closeModal;
  closeModal=function(){
    bmmCloseModalBeforeAutoCompletion();
    if(bmmFormDirty){bmmFormDirty=false;bmmUpdateDataStatusUI();}
    setTimeout(bmmRunAutomaticCompletionCheck,0);
  };
  window.setInterval(bmmRunAutomaticCompletionCheck,60*1000);
  window.addEventListener('focus',bmmRunAutomaticCompletionCheck);
  window.addEventListener('pageshow',bmmRunAutomaticCompletionCheck);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)bmmRunAutomaticCompletionCheck();});

  // Phase D: read-only data quality review + filterable change history.
  function bmmBuildDataQualityReport(source=state){
    const repertoire=Array.isArray(source?.repertoire)?source.repertoire:[];
    const events=Array.isArray(source?.events)?source.events:[];
    const members=Array.isArray(source?.members)?source.members:[];
    const ids=new Set(repertoire.map(m=>String(m?.id||'')));
    const issues=[];
    const clean=value=>String(value??'').trim();
    const norm=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g,' ').trim();
    const isValidDate=value=>{const d=clean(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const parsed=new Date(`${d}T12:00:00Z`);return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===d;};
    const cancelled=status=>/^cancelad/i.test(clean(status));
    const add=(severity,code,entityType,entityId,entityName,message,section)=>issues.push({severity,code,entityType,entityId:String(entityId||''),entityName:clean(entityName)||'Registro sin nombre',message,section,key:`${code}:${entityType}:${entityId||'sin-id'}:${issues.length}`});
    const marchNames=new Map();
    for(const m of repertoire){
      const name=clean(m?.name),key=norm(name);
      if(!key||/^marcha sin titulo$/i.test(name))add('error','march-missing-name','march',m?.id,name||'Marcha sin título','La ficha no tiene un título identificable.','repertorio');
      if(!clean(m?.author))add('info','march-missing-author','march',m?.id,name,'No se ha indicado el autor o compositor.','repertorio');
      if(!clean(m?.style)&&!clean(m?.genre))add('info','march-unclassified','march',m?.id,name,'La marcha no tiene estilo ni género clasificado.','repertorio');
      if(key){if(!marchNames.has(key))marchNames.set(key,[]);marchNames.get(key).push(m);}
    }
    for(const [key,items] of marchNames){
      if(items.length>1){const target=items[items.length-1];add('warning','march-duplicate-title','march',target.id,target.name,`Hay ${items.length} fichas con el mismo título (ignorando mayúsculas y tildes). Comprueba si son duplicadas o versiones distintas.`,'repertorio');}
    }
    const eventKeys=new Map();
    for(const e of events){
      const name=clean(e?.name),date=clean(e?.date),group=clean(e?.group),locality=clean(e?.locality),plays=Array.isArray(e?.marches)?e.marches:[];
      if(!isValidDate(date))add('error','event-invalid-date','event',e?.id,name, date?'La fecha no tiene un formato de calendario válido.':'La actuación no tiene fecha.','actuaciones');
      if(!name||/^actuacion sin titulo$/i.test(name))add('error','event-missing-name','event',e?.id,name,'La actuación necesita un nombre identificable.','actuaciones');
      if(!plays.length&&!cancelled(e?.status))add('warning','event-without-marches','event',e?.id,name,'No hay marchas anotadas en esta actuación.','actuaciones');
      if(!group)add('info','event-missing-group','event',e?.id,name,'No se ha asignado un grupo o campaña.','actuaciones');
      if(!locality)add('info','event-missing-locality','event',e?.id,name,'No se ha indicado la localidad o el lugar.','actuaciones');
      for(const p of plays){
        if(!clean(p?.marchId))add('warning','event-performance-without-march','event',e?.id,name,'Hay una fila de interpretación sin una marcha seleccionada.','actuaciones');
        else if(!ids.has(String(p.marchId)))add('error','event-broken-march-reference','event',e?.id,name,`Una aparición apunta a una marcha que ya no existe en el repertorio (referencia ${clean(p.marchId)}).`,'actuaciones');
      }
      const eventKey=[date,norm(name),norm(group),norm(locality)].join('|');
      if(date&&name&&eventKey!=='|||'){
        if(!eventKeys.has(eventKey))eventKeys.set(eventKey,[]);eventKeys.get(eventKey).push(e);
      }
    }
    for(const items of eventKeys.values())if(items.length>1){const target=items[items.length-1];add('warning','event-possible-duplicate','event',target.id,target.name,`Hay ${items.length} actuaciones con la misma fecha, nombre, grupo y localidad. Revisa si existe algún duplicado.`,'actuaciones');}
    for(const m of members){
      const name=clean(m?.name);
      if(!name||/^integrante sin nombre$/i.test(name))add('warning','member-missing-name','member',m?.id,name,'La ficha del integrante no tiene un nombre identificable.','integrantes');
      if(!clean(m?.instrument))add('info','member-missing-instrument','member',m?.id,name,'No se ha indicado el instrumento o sección.','integrantes');
    }
    const rank={error:0,warning:1,info:2};
    issues.sort((a,b)=>rank[a.severity]-rank[b.severity]||a.entityName.localeCompare(b.entityName,'es'));
    return {issues,totals:{error:issues.filter(x=>x.severity==='error').length,warning:issues.filter(x=>x.severity==='warning').length,info:issues.filter(x=>x.severity==='info').length},scanned:{marches:repertoire.length,events:events.length,members:members.length,performances:events.reduce((n,e)=>n+(Array.isArray(e.marches)?e.marches.length:0),0)}};
  }
  let bmmQualityQuery='',bmmQualitySeverity='all';
  function bmmQualityFilteredIssues(){
    const report=bmmBuildDataQualityReport(bmmFullDatasetForQuality||state),q=bmmQualityQuery.trim().toLocaleLowerCase('es');
    return report.issues.filter(x=>(bmmQualitySeverity==='all'||x.severity===bmmQualitySeverity)&&(!q||[x.entityName,x.message,x.code,x.section].join(' ').toLocaleLowerCase('es').includes(q)));
  }
  const bmmQualitySeverityLabel={error:'Requiere atención',warning:'Revisar',info:'Información'};
  function bmmQualityIssueMarkup(issue){return `<article class="bmm-quality-issue bmm-quality-${esc(issue.severity)}"><div class="bmm-quality-issue-text"><div class="bmm-quality-issue-top"><span class="bmm-quality-severity">${esc(bmmQualitySeverityLabel[issue.severity]||issue.severity)}</span><strong>${esc(issue.entityName)}</strong></div><p>${esc(issue.message)}</p><small>${esc(issue.section==='repertorio'?'Repertorio':issue.section==='actuaciones'?'Actuaciones':'Integrantes')} · ${esc(issue.code)}</small></div><button type="button" class="btn btn-soft btn-small" data-action="quality-review" data-issue-key="${esc(issue.key)}">Revisar</button></article>`;}
  function bmmQualityHTML(){
    const report=bmmBuildDataQualityReport(bmmFullDatasetForQuality||state),tot=report.totals,issues=report.issues;
    return `<section class="pro-card bmm-quality-card"><div class="pro-card-head"><div><h2>Calidad de los datos</h2><p>Revisión de marchas, actuaciones e integrantes para localizar información incompleta o posibles duplicados.</p></div><span class="audit-badge">${issues.length} observaciones</span></div><div class="pro-card-body"><div class="bmm-quality-summary"><div class="bmm-quality-counter is-error"><span>Requieren atención</span><strong>${tot.error}</strong></div><div class="bmm-quality-counter is-warning"><span>Revisar</span><strong>${tot.warning}</strong></div><div class="bmm-quality-counter is-info"><span>Información</span><strong>${tot.info}</strong></div></div><p class="bmm-quality-scope">Analizados: ${report.scanned.marches} marchas, ${report.scanned.events} actuaciones y ${report.scanned.members} integrantes. Esta revisión es de solo lectura y no modifica ningún dato automáticamente.</p>${issues.length?`<div class="bmm-quality-preview">${issues.slice(0,4).map(bmmQualityIssueMarkup).join('')}</div>`:'<div class="bmm-quality-clean"><strong>✓ No se han detectado incidencias con estas reglas</strong><span>El catálogo y las actuaciones no presentan los problemas comprobados.</span></div>'}<div class="toolbar bmm-quality-actions"><button type="button" class="btn btn-primary" data-action="quality-open">Ver todas las observaciones</button><button type="button" class="btn btn-soft" data-action="quality-export">Exportar incidencias CSV</button></div></div></section>`;
  }
  function bmmQualityModalBody(){
    const report=bmmBuildDataQualityReport(state),issues=bmmQualityFilteredIssues();
    return `<div class="bmm-quality-modal-filters"><div class="field"><label for="bmmQualityQuery">Buscar incidencia</label><input id="bmmQualityQuery" type="search" value="${esc(bmmQualityQuery)}" placeholder="Nombre, detalle o código…"></div><div class="field"><label for="bmmQualitySeverity">Prioridad</label><select id="bmmQualitySeverity"><option value="all" ${bmmQualitySeverity==='all'?'selected':''}>Todas</option><option value="error" ${bmmQualitySeverity==='error'?'selected':''}>Requiere atención (${report.totals.error})</option><option value="warning" ${bmmQualitySeverity==='warning'?'selected':''}>Revisar (${report.totals.warning})</option><option value="info" ${bmmQualitySeverity==='info'?'selected':''}>Información (${report.totals.info})</option></select></div><button type="button" class="btn btn-soft btn-small" data-action="quality-reset-filters">Restablecer</button></div><p class="bmm-modal-help">Las observaciones son sugerencias de revisión, no errores confirmados en todos los casos. Los duplicados posibles deben comprobarse antes de eliminar datos.</p>${issues.length?`<div class="bmm-quality-issue-list">${issues.slice(0,250).map(bmmQualityIssueMarkup).join('')}</div><p class="bmm-tool-note">Mostrando ${Math.min(issues.length,250)} de ${issues.length} observaciones. Exporta CSV para revisar el listado completo.</p>`:'<div class="bmm-quality-clean"><strong>Sin observaciones para los filtros elegidos</strong><span>Prueba con otra prioridad o elimina la búsqueda.</span></div>'}`;
  }
  function bmmOpenQualityModal(){bmmQualityQuery='';bmmQualitySeverity='all';openModal('Calidad de los datos','Observaciones que puedes revisar antes de exportar o seguir registrando',bmmQualityModalBody(),'<button class="btn btn-soft" type="button" data-action="close-modal">Cerrar</button><button class="btn btn-primary" type="button" data-action="quality-export">Exportar CSV</button>');}
  function bmmRefreshModalBody(builder,focusId=''){const slot=document.querySelector('#modal .modal-content');if(!slot)return;let selection=null;const old=focusId?document.getElementById(focusId):null;if(old)selection={start:old.selectionStart,end:old.selectionEnd};slot.innerHTML=builder();if(focusId){const next=document.getElementById(focusId);next?.focus();if(selection&&next?.setSelectionRange)try{next.setSelectionRange(selection.start,selection.end)}catch(_){}}}
  function bmmExportQualityCSV(){
    const report=bmmBuildDataQualityReport(bmmFullDatasetForQuality||state);const rows=[['Prioridad','Código','Sección','Tipo de registro','Registro','Identificador','Observación'],...report.issues.map(x=>[bmmQualitySeverityLabel[x.severity]||x.severity,x.code,bmmPageNames[x.page]||x.section,x.entityType,x.entityName,x.entityId,x.message])];
    download(`bmm-santa-cecilia-calidad-datos-${bmmTodayKey()}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');showToast(`Exportadas ${report.issues.length} observaciones de calidad.`);
  }
  function bmmReviewQualityIssue(key){
    const issue=bmmBuildDataQualityReport(state).issues.find(x=>x.key===key);if(!issue){showToast('La observación ya no está disponible. Actualiza el análisis.',true);return;}
    closeModal();
    if(issue.entityType==='event'){
      const item=state.events.find(x=>String(x.id)===issue.entityId);if(!item){showToast('No se encuentra la actuación que originó la observación.',true);return;}setPage('actuaciones');render();eventForm(item);return;
    }
    if(issue.entityType==='march'){
      const item=state.repertoire.find(x=>String(x.id)===issue.entityId);if(!item){showToast('No se encuentra la marcha que originó la observación.',true);return;}setPage('repertorio');render();marchForm(item);return;
    }
    if(issue.entityType==='member'){
      const item=(state.members||[]).find(x=>String(x.id)===issue.entityId);if(!item){showToast('No se encuentra el integrante que originó la observación.',true);return;}setPage('integrantes');render();bmmOpenMemberForm(item);return;
    }
  }
  const bmmPhaseDStyle=document.createElement('style');bmmPhaseDStyle.id='bmm-phase-d-quality-style';bmmPhaseDStyle.textContent=`
    .bmm-quality-card{margin-top:18px}.bmm-quality-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:12px}.bmm-quality-counter{min-width:0;border:1px solid var(--bmm-border,#d7e2d5);border-radius:12px;padding:11px;background:var(--bmm-surface,#fffdf8)}.bmm-quality-counter span{display:block;font-size:11px;line-height:1.3;color:var(--bmm-muted,#627368)}.bmm-quality-counter strong{display:block;margin-top:4px;font-size:25px;color:var(--bmm-text,#1a3928)}.bmm-quality-counter.is-error{border-top:3px solid #b64a47}.bmm-quality-counter.is-warning{border-top:3px solid #c3a04a}.bmm-quality-counter.is-info{border-top:3px solid #6d9bb3}.bmm-quality-scope{font-size:12px;line-height:1.5;color:var(--bmm-muted,#627368)}.bmm-quality-preview,.bmm-quality-issue-list{display:grid;gap:8px;margin:12px 0}.bmm-quality-issue{display:flex;justify-content:space-between;align-items:center;gap:12px;min-width:0;border:1px solid var(--bmm-border,#d7e2d5);border-left:4px solid #6d9bb3;border-radius:12px;padding:11px;background:var(--bmm-surface,#fffdf8)}.bmm-quality-error{border-left-color:#b64a47}.bmm-quality-warning{border-left-color:#c3a04a}.bmm-quality-info{border-left-color:#6d9bb3}.bmm-quality-issue-text{min-width:0;flex:1}.bmm-quality-issue-top{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.bmm-quality-issue-top strong{font-size:13px;color:var(--bmm-text,#173629);overflow-wrap:anywhere}.bmm-quality-severity{font-size:9px;letter-spacing:.2px;text-transform:uppercase;border-radius:6px;padding:4px 6px;background:var(--bmm-raised,#edf2eb);color:var(--bmm-muted,#52675a);font-weight:800}.bmm-quality-issue p{margin:5px 0;font-size:12px;line-height:1.45;color:var(--bmm-muted,#5b6e61)}.bmm-quality-issue small{font-size:10px;color:var(--bmm-muted,#6a7b70)}.bmm-quality-clean{display:grid;gap:5px;padding:18px;border:1px solid var(--bmm-border,#d7e2d5);border-radius:12px;background:var(--bmm-raised,#f3f7f1);color:var(--bmm-text,#173629)}.bmm-quality-clean span{font-size:12px;color:var(--bmm-muted,#627368)}.bmm-quality-actions{margin-top:14px}.bmm-audit-filters,.bmm-quality-modal-filters{display:grid;grid-template-columns:minmax(0,2fr) minmax(150px,1fr) minmax(150px,1fr) auto;gap:9px;align-items:end;margin:10px 0 12px}.bmm-quality-modal-filters{grid-template-columns:minmax(0,2fr) minmax(180px,1fr) auto}.bmm-audit-filters .field,.bmm-quality-modal-filters .field{min-width:0}.bmm-audit-filters label,.bmm-quality-modal-filters label{font-size:10px}.bmm-audit-filters input,.bmm-audit-filters select,.bmm-quality-modal-filters input,.bmm-quality-modal-filters select{width:100%;min-width:0}.bmm-audit-filters .btn,.bmm-quality-modal-filters .btn{white-space:normal}.bmm-audit-modal-table{max-height:min(52vh,620px)}
    html[data-bmm-resolved-theme="dark"] .bmm-quality-counter,html[data-bmm-resolved-theme="dark"] .bmm-quality-issue,html[data-bmm-resolved-theme="dark"] .bmm-quality-clean{background:#12271a;border-color:#314d3b}html[data-bmm-resolved-theme="dark"] .bmm-quality-issue-top strong,html[data-bmm-resolved-theme="dark"] .bmm-quality-clean{color:#edf4ef}
    @media(max-width:760px){.bmm-quality-summary{gap:6px}.bmm-quality-counter{padding:9px 7px}.bmm-quality-counter span{font-size:9px}.bmm-quality-counter strong{font-size:22px}.bmm-quality-issue{align-items:flex-start;gap:8px;padding:9px}.bmm-quality-issue .btn{flex:0 0 auto;align-self:center}.bmm-audit-filters,.bmm-quality-modal-filters{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bmm-audit-filters .field:first-child,.bmm-quality-modal-filters .field:first-child{grid-column:1/-1}.bmm-audit-filters>.btn,.bmm-quality-modal-filters>.btn{width:100%}}
  `;document.head.appendChild(bmmPhaseDStyle);
  const bmmRenderConfigBeforePhaseD=renderConfig;
  renderConfig=function(){return bmmRenderConfigBeforePhaseD()+bmmQualityHTML();};
  const bmmHandleBeforePhaseD=handleAction;
  handleAction=function(el){
    const action=el?.dataset?.action;
    if(action==='quality-open'){bmmOpenQualityModal();return;}
    if(action==='quality-export'){bmmExportQualityCSV();return;}
    if(action==='quality-review'){bmmReviewQualityIssue(el.dataset.issueKey||'');return;}
    if(action==='quality-reset-filters'){bmmQualityQuery='';bmmQualitySeverity='all';bmmRefreshModalBody(bmmQualityModalBody);return;}
    if(action==='audit-reset-filters'){bmmAuditQuery='';bmmAuditSection='all';bmmAuditKind='all';bmmRefreshModalBody(bmmAuditModalBody);return;}
    if(action==='export-audit'){
      const rows=[['Fecha','Sección','Tipo','Detalle'],...bmmAuditFilteredRows(Number.MAX_SAFE_INTEGER).map(x=>[x.at,bmmPageNames[x.page]||x.page,x.kind,x.label])];
      download(`bmm-santa-cecilia-registro-cambios-${bmmTodayKey()}.csv`,'\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');showToast(`Exportados ${rows.length-1} registros del historial.`);return;
    }
    return bmmHandleBeforePhaseD(el);
  };
  document.addEventListener('input',function(e){
    const t=e.target;if(t?.id==='bmmAuditQuery'){bmmAuditQuery=t.value;bmmRefreshModalBody(bmmAuditModalBody,'bmmAuditQuery');}
    else if(t?.id==='bmmQualityQuery'){bmmQualityQuery=t.value;bmmRefreshModalBody(bmmQualityModalBody,'bmmQualityQuery');}
  });
  document.addEventListener('change',function(e){
    const t=e.target;if(t?.id==='bmmAuditSection'){bmmAuditSection=t.value;bmmRefreshModalBody(bmmAuditModalBody);}
    else if(t?.id==='bmmAuditKind'){bmmAuditKind=t.value;bmmRefreshModalBody(bmmAuditModalBody);}
    else if(t?.id==='bmmQualitySeverity'){bmmQualitySeverity=t.value;bmmRefreshModalBody(bmmQualityModalBody);}
  });

  // Phase E: persist only pending-sync metadata. The musical state remains in the existing local store;
  // this marker never contains tokens or credentials and never bypasses ETag/conflict protections.
  const BMM_PENDING_QUEUE_KEY = STORE_KEY + '.cloud-pending-v1';
  let bmmPendingQueueRetryTimer = null;
  function bmmQueueFingerprint(value){
    let textValue='';
    try{textValue=JSON.stringify(bmmPayloadForComparison(value));}catch(_){textValue=JSON.stringify(value||{});}
    let hash=2166136261;
    for(let i=0;i<textValue.length;i++){hash^=textValue.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function bmmReadPendingQueue(){
    try{const raw=localStorage.getItem(BMM_PENDING_QUEUE_KEY);if(!raw)return null;const item=JSON.parse(raw);return item&&item.schema===1&&typeof item.fingerprint==='string'?item:null;}catch(_){return null;}
  }
  function bmmPersistPendingQueue(reason='pending'){
    try{
      const item={schema:1,queuedAt:new Date().toISOString(),reason:String(reason).slice(0,80),fingerprint:bmmQueueFingerprint(state),baseCloudUpdatedAt:state?.cloudUpdatedAt||null};
      localStorage.setItem(BMM_PENDING_QUEUE_KEY,JSON.stringify(item));
      return true;
    }catch(_){
      console.warn('BMM pending-sync marker could not be persisted; the primary local state is retained where available.');
      return false;
    }
  }
  function bmmClearPendingQueue(){
    if(bmmPendingQueueRetryTimer){clearTimeout(bmmPendingQueueRetryTimer);bmmPendingQueueRetryTimer=null;}
    try{localStorage.removeItem(BMM_PENDING_QUEUE_KEY);}catch(_){}
  }
  const bmmPendingQueueAtStartup=bmmReadPendingQueue();
  if(bmmPendingQueueAtStartup){
    bmmCloudPending=true;
    bmmAutoSyncWhenOnline=true;
  }
  const bmmSyncBeforePersistentQueue=bmmSyncNow;
  bmmSyncNow=async function(){
    if(bmmCloudMode&&bmmAuthenticated&&!bmmCloudConflictState&&!bmmHasUnresolvedLocalRecovery()){
      bmmPersistPendingQueue('sync-in-progress');
    }
    const ok=await bmmSyncBeforePersistentQueue();
    if(ok&&!bmmCloudPending&&!bmmCloudConflictState){
      bmmClearPendingQueue();
      bmmAutoSyncWhenOnline=false;
      bmmOnlineRetryCount=0;
    }else if(bmmCloudMode&&bmmAuthenticated&&!bmmHasUnresolvedLocalRecovery()){
      bmmPersistPendingQueue(bmmCloudConflictState?'conflict':'sync-pending');
      // A genuine conflict is not retried automatically; it requires an explicit user decision.
      if(!bmmCloudConflictState)bmmAutoSyncWhenOnline=true;
    }
    bmmUpdateDataStatusUI();
    return ok;
  };
  const bmmLoadBeforePersistentQueue=bmmLoadCloud;
  bmmLoadCloud=async function(){
    const ok=await bmmLoadBeforePersistentQueue();
    if(ok&&!bmmCloudConflictState){
      const queued=bmmReadPendingQueue();
      if(!bmmCloudPending){bmmClearPendingQueue();}
      else if(queued){
        // Keep the marker only when the locally held payload is still the one queued.
        // Never restore an old queue snapshot over current data.
        if(queued.fingerprint!==bmmQueueFingerprint(state))bmmPersistPendingQueue('local-state-changed');
        if(bmmCloudMode&&bmmAuthenticated&&!bmmFormDirty&&navigator.onLine!==false){
          if(bmmPendingQueueRetryTimer)clearTimeout(bmmPendingQueueRetryTimer);
          bmmPendingQueueRetryTimer=setTimeout(()=>{bmmPendingQueueRetryTimer=null;if(bmmReadPendingQueue()&&bmmCloudPending&&!bmmCloudConflictState&&!bmmHasUnresolvedLocalRecovery())bmmSyncNow();},1000);
        }
      }
    }
    return ok;
  };
  window.addEventListener('online',function(){
    if(!bmmReadPendingQueue()||!bmmCloudMode||!bmmAuthenticated||bmmCloudConflictState||bmmHasUnresolvedLocalRecovery()||bmmFormDirty)return;
    if(bmmPendingQueueRetryTimer)clearTimeout(bmmPendingQueueRetryTimer);
    bmmPendingQueueRetryTimer=setTimeout(()=>{
      bmmPendingQueueRetryTimer=null;
      if(bmmReadPendingQueue()&&bmmCloudPending&&!bmmCloudConflictState)bmmSyncNow();
    },1200);
  });

  // Ensure local and cloud save state is reflected after all overrides.
  bmmEnsureFloatingSave();bmmRefreshTopbar();bmmRefreshStatus();bmmInitAuth();render();

})();
