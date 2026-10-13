(() => {
  const baseRender=render;
  render=function(){
    const active=document.activeElement;
    const focusId=active?.closest('#content')?active.id:null;
    const selection=active?.matches('input[type="text"],input[type="search"],textarea')?[active.selectionStart,active.selectionEnd]:null;
    const previousCatalogue=bmmRenderCatalogue;
    bmmRenderCatalogue=bmmCatalogueIndex();
    try{baseRender();}finally{bmmRenderCatalogue=previousCatalogue;}
    bmmAssociateLabels(document.getElementById('content'));
    document.querySelectorAll('[data-page]').forEach(button=>{
      if(button.dataset.page===page)button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.icon-btn[title]:not([aria-label])').forEach(button=>button.setAttribute('aria-label',button.title));
    document.querySelectorAll('.timeline-info h3,.group-tile > h3,.member-heading h3').forEach(heading=>heading.setAttribute('aria-level','2'));
    document.querySelector('.topbar [data-action="add-event"]')?.setAttribute('aria-label','Nueva actuación');
    if(focusId){
      const replacement=document.getElementById(focusId);
      replacement?.focus({preventScroll:true});
      if(selection&&replacement?.setSelectionRange)replacement.setSelectionRange(...selection);
    }
  };
  const header=document.querySelector('.topbar');
  new ResizeObserver(entries=>{
    const height=Math.ceil(entries[0].target.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--bmm-header-height',`${height}px`);
  }).observe(header);
  function updateVisualHeight(){
    document.documentElement.style.setProperty('--bmm-visual-height',`${window.visualViewport?.height||window.innerHeight}px`);
  }
  window.visualViewport?.addEventListener('resize',updateVisualHeight);
  window.addEventListener('resize',updateVisualHeight);
  updateVisualHeight();
  document.querySelector('.topbar .top-right .btn[data-action="add-event"]')?.setAttribute('aria-label','Nueva actuación');
  document.querySelector('.mobile-brand').textContent='BMM Santa Cecilia';
  new MutationObserver(()=>bmmAssociateLabels(document.getElementById('modal'))).observe(document.getElementById('modal'),{childList:true,subtree:true});
  render();
})();
