(function(){
  const root=document.documentElement;
  const media=window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function syncResolved(){
    const mode=root.dataset.bmmTheme || 'auto';
    const dark=mode==='dark' || (mode==='auto' && !!(media && media.matches));
    root.dataset.bmmResolvedTheme=dark?'dark':'light';
    root.style.colorScheme=dark?'dark':'light';
  }
  syncResolved();
  try { new MutationObserver(records=>{if(records.some(r=>r.attributeName==='data-bmm-theme')) syncResolved();}).observe(root,{attributes:true,attributeFilter:['data-bmm-theme']}); } catch(_) {}
  if(media){ if(media.addEventListener) media.addEventListener('change',syncResolved); else if(media.addListener) media.addListener(syncResolved); }
  const style=document.createElement('style');
  style.id='bmm-theme-palette-audit-v10-css';
  style.textContent = `
/* BMM theme audit v10 — wholly independent light/dark palettes. */
html[data-bmm-resolved-theme="light"] {
  color-scheme:light;
  --ink:#173629; --muted:#4b6254; --text-soft:#3d5748;
  --bg:#f4f7f1; --paper:#fffefa; --surface-elevated:#f0f5ed;
  --field-bg:#ffffff; --input-border:#b8cabb; --line:#d3dfd2;
  --green:#17643f; --red:#a32635; --red2:#84202c; --gold:#8d701d;
  --accent-soft:#e5efe2; --accent-ink:#1d5939; --section-tint:#eaf2e6;
  --nav:#f8faf5; --nav2:#e9f1e6; --shadow:0 12px 32px rgba(19,56,39,.07);
  --bmm-ui-bg:#f4f7f1; --bmm-ui-surface:#fffefa; --bmm-ui-raised:#f0f5ed;
  --bmm-ui-text:#173629; --bmm-ui-muted:#4b6254; --bmm-ui-border:#d3dfd2;
  --bmm-ui-field:#fff; --bmm-ui-link:#17643f; --bmm-ui-chip:#e5efe2; --bmm-ui-chip-text:#1d5939;
}
html[data-bmm-resolved-theme="dark"] {
  color-scheme:dark;
  --ink:#f2f7f3; --muted:#c1d1c6; --text-soft:#d3e0d7;
  --bg:#07140d; --paper:#102218; --surface-elevated:#172f21;
  --field-bg:#0b1c12; --input-border:#46634e; --line:#304b39;
  --green:#8ddbA6; --red:#ffb1b9; --red2:#ffcbd0; --gold:#e6cd78;
  --accent-soft:#20402b; --accent-ink:#e0f4e4; --section-tint:#163222;
  --nav:#071b12; --nav2:#0f2b1d; --shadow:0 14px 34px rgba(0,0,0,.25);
  --bmm-ui-bg:#07140d; --bmm-ui-surface:#102218; --bmm-ui-raised:#172f21;
  --bmm-ui-text:#f2f7f3; --bmm-ui-muted:#c1d1c6; --bmm-ui-border:#304b39;
  --bmm-ui-field:#0b1c12; --bmm-ui-link:#a6e8b7; --bmm-ui-chip:#20402b; --bmm-ui-chip-text:#e0f4e4;
}
html[data-bmm-resolved-theme="light"], html[data-bmm-resolved-theme="dark"] { background:var(--bmm-ui-bg)!important; }
html[data-bmm-resolved-theme="light"] body, html[data-bmm-resolved-theme="dark"] body,
html[data-bmm-resolved-theme] .app, html[data-bmm-resolved-theme] .main,
html[data-bmm-resolved-theme] .content, html[data-bmm-resolved-theme] .page-content {
  background-color:var(--bmm-ui-bg)!important; color:var(--bmm-ui-text)!important;
}
html[data-bmm-resolved-theme] body { color:var(--bmm-ui-text)!important; }
/* Sidebar changes with the selected theme too (the active item keeps a branded green treatment). */
html[data-bmm-resolved-theme="light"] .sidebar { background:linear-gradient(165deg,#f9fbf6,#eaf2e7)!important; color:#173629!important; border-right:1px solid #d3dfd2!important; }
html[data-bmm-resolved-theme="light"] .sidebar .brand-name, html[data-bmm-resolved-theme="light"] .sidebar .nav-label { color:#173629!important; }
html[data-bmm-resolved-theme="light"] .sidebar .brand-sub, html[data-bmm-resolved-theme="light"] .sidebar .nav button { color:#40594a!important; }
html[data-bmm-resolved-theme="light"] .sidebar .nav button.active { color:#fffefa!important; background:linear-gradient(120deg,#17643f,#0d4d31)!important; border-color:#b99a43!important; }
html[data-bmm-resolved-theme="dark"] .sidebar { background:linear-gradient(155deg,#071b12,#0c2a1c 56%,#06170f)!important; color:#f2f7f3!important; border-right:1px solid #304b39!important; }
html[data-bmm-resolved-theme="dark"] .sidebar .brand-name, html[data-bmm-resolved-theme="dark"] .sidebar .nav-label { color:#f2f7f3!important; }
html[data-bmm-resolved-theme="dark"] .sidebar .brand-sub, html[data-bmm-resolved-theme="dark"] .sidebar .nav button { color:#c1d1c6!important; }
html[data-bmm-resolved-theme="dark"] .sidebar .nav button.active { color:#fffefa!important; background:linear-gradient(120deg,#176b47,#0b4d31)!important; border-color:#d3b65b!important; }
/* Top navigation, headings, descriptions and text hierarchy. */
html[data-bmm-resolved-theme] .topbar { color:var(--bmm-ui-text)!important; border-bottom-color:var(--bmm-ui-border)!important; }
html[data-bmm-resolved-theme="light"] .topbar { background-color:#f7faf4!important; background-image:linear-gradient(90deg,rgba(248,250,245,.98),rgba(248,250,245,.90)),url('assets/bmm-header-banner.webp')!important; }
html[data-bmm-resolved-theme="dark"] .topbar { background-color:#0b2016!important; background-image:linear-gradient(90deg,rgba(7,24,15,.98),rgba(7,24,15,.91)),url('assets/bmm-header-banner.webp')!important; border-bottom-color:#304b39!important; }
html[data-bmm-resolved-theme] .topbar .top-title, html[data-bmm-resolved-theme] .topbar h1,
html[data-bmm-resolved-theme] .topbar h2, html[data-bmm-resolved-theme] .page-head h1,
html[data-bmm-resolved-theme] .page-head h2, html[data-bmm-resolved-theme] .content h1,
html[data-bmm-resolved-theme] .content h2, html[data-bmm-resolved-theme] .content h3,
html[data-bmm-resolved-theme] .content h4, html[data-bmm-resolved-theme] .card h2,
html[data-bmm-resolved-theme] .pro-card h2, html[data-bmm-resolved-theme] .card-head h2,
html[data-bmm-resolved-theme] .pro-card-head h2 { color:var(--bmm-ui-text)!important; opacity:1!important; }
html[data-bmm-resolved-theme] .crumb, html[data-bmm-resolved-theme] .topbar-kicker,
html[data-bmm-resolved-theme] .page-head p, html[data-bmm-resolved-theme] .card-sub,
html[data-bmm-resolved-theme] .card-subtitle, html[data-bmm-resolved-theme] .section-filter-note,
html[data-bmm-resolved-theme] .footnote, html[data-bmm-resolved-theme] .field-hint,
html[data-bmm-resolved-theme] .help-text, html[data-bmm-resolved-theme] .stat-foot,
html[data-bmm-resolved-theme] .pro-card-head p, html[data-bmm-resolved-theme] .card-head p,
html[data-bmm-resolved-theme] .content .muted, html[data-bmm-resolved-theme] .content .subtitle,
html[data-bmm-resolved-theme] .content .sub, html[data-bmm-resolved-theme] .content .member-meta,
html[data-bmm-resolved-theme] .content .event-notes, html[data-bmm-resolved-theme] .content .timeline-meta,
html[data-bmm-resolved-theme] .content .chart-caption, html[data-bmm-resolved-theme] .content .report-preview-note {
  color:var(--bmm-ui-muted)!important; opacity:1!important;
}
html[data-bmm-resolved-theme="dark"] .eyebrow, html[data-bmm-resolved-theme="dark"] .page-head .eyebrow { color:var(--gold)!important; }
html[data-bmm-resolved-theme="light"] .eyebrow, html[data-bmm-resolved-theme="light"] .page-head .eyebrow { color:#276b49!important; }
/* All application surfaces: cards, settings, chart panels, groups, events, modals and expandable areas. */
html[data-bmm-resolved-theme] .content :is(.card,.pro-card,.stat-card,.pro-kpi,.filter-panel,.global-filterbar,.event-card,.event-accordion,.group-tile,.group-card,.member-card,.member-empty,.chart-card,.chart-wrap,.timeline-item,.timeline-card,.settings-card,.setting-card,.config-card,.form-card,.report-selection-bar,.report-options,.report-builder,.report-selection,.accordion-panel,.modal,.modal-content,.bmm-theme-option,.pwa-install-note,.empty-state,.empty-state-card,.chart-empty,.filter-results,.group-summary,.stat-panel,.data-panel,.table-wrap,.table-scroll,.audit-panel,.settings-panel,.insights-panel,.insight-row,.quick-action) {
  color:var(--bmm-ui-text)!important; border-color:var(--bmm-ui-border)!important;
}
html[data-bmm-resolved-theme="light"] .content :is(.card,.pro-card,.stat-card,.pro-kpi,.filter-panel,.global-filterbar,.event-card,.event-accordion,.group-tile,.group-card,.member-card,.member-empty,.chart-card,.timeline-item,.timeline-card,.settings-card,.setting-card,.config-card,.form-card,.report-selection-bar,.report-options,.report-builder,.report-selection,.accordion-panel,.modal,.modal-content,.bmm-theme-option,.pwa-install-note,.empty-state,.empty-state-card,.chart-empty,.filter-results,.group-summary,.stat-panel,.data-panel,.table-wrap,.table-scroll,.audit-panel,.settings-panel,.insights-panel) { background:linear-gradient(145deg,#fffefa,#f0f5ed)!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.card,.pro-card,.stat-card,.pro-kpi,.filter-panel,.global-filterbar,.event-card,.event-accordion,.group-tile,.group-card,.member-card,.member-empty,.chart-card,.timeline-item,.timeline-card,.settings-card,.setting-card,.config-card,.form-card,.report-selection-bar,.report-options,.report-builder,.report-selection,.accordion-panel,.modal,.modal-content,.bmm-theme-option,.pwa-install-note,.empty-state,.empty-state-card,.chart-empty,.filter-results,.group-summary,.stat-panel,.data-panel,.table-wrap,.table-scroll,.audit-panel,.settings-panel,.insights-panel) { background:linear-gradient(145deg,#132b1d,#0d2016 82%)!important; box-shadow:0 10px 26px rgba(0,0,0,.13)!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.pro-card-head,.card-head,.event-card-head,.group-card-head,.panel-head) { background:transparent!important; border-color:var(--bmm-ui-border)!important; }
/* Quick actions and insight cards had fixed light backgrounds in earlier styles. */
html[data-bmm-resolved-theme="light"] .content :is(.insight-row,.quick-action) { background:linear-gradient(135deg,#fffefa,#eff5ec)!important; color:#173629!important; border:1px solid #cfddcf!important; }
html[data-bmm-resolved-theme="light"] .content :is(.insight-row strong,.quick-action strong) { color:#173629!important; opacity:1!important; }
html[data-bmm-resolved-theme="light"] .content :is(.insight-row span,.quick-action span:not(.qa-icon)) { color:#4b6254!important; opacity:1!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.insight-row,.quick-action) { background:linear-gradient(145deg,#173423,#10251a)!important; color:#f2f7f3!important; border:1px solid #355541!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.insight-row strong,.quick-action strong) { color:#f2f7f3!important; opacity:1!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.insight-row span,.quick-action span:not(.qa-icon)) { color:#cbdcd0!important; opacity:1!important; }
html[data-bmm-resolved-theme] .insight-icon, html[data-bmm-resolved-theme] .qa-icon { border-radius:12px!important; }
html[data-bmm-resolved-theme="light"] .content :is(.insight-icon,.qa-icon,.stat-icon,.pro-kpi-icon) { background:#e4efe0!important; color:#1d6541!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.insight-icon,.qa-icon,.stat-icon,.pro-kpi-icon) { background:#254431!important; color:#b9edc6!important; border-color:#3d6448!important; }
/* Inputs, selects, checks, date fields and every customization form. */
html[data-bmm-resolved-theme] .content input:not([type=checkbox]):not([type=radio]):not([type=range]),
html[data-bmm-resolved-theme] .content select, html[data-bmm-resolved-theme] .content textarea,
html[data-bmm-resolved-theme] .global-filterbar input, html[data-bmm-resolved-theme] .global-filterbar select,
html[data-bmm-resolved-theme] .filter-panel input, html[data-bmm-resolved-theme] .filter-panel select,
html[data-bmm-resolved-theme] .filter-panel textarea, html[data-bmm-resolved-theme] .login-card input {
  background-color:var(--bmm-ui-field)!important; background-image:none!important; color:var(--bmm-ui-text)!important;
  border:1px solid var(--input-border)!important; box-shadow:none!important; caret-color:var(--bmm-ui-link)!important;
}
html[data-bmm-resolved-theme] .content label, html[data-bmm-resolved-theme] .content legend,
html[data-bmm-resolved-theme] .content .field label, html[data-bmm-resolved-theme] .content .filter-panel label,
html[data-bmm-resolved-theme] .content .global-filterbar label { color:var(--bmm-ui-muted)!important; opacity:1!important; }
html[data-bmm-resolved-theme] input::placeholder, html[data-bmm-resolved-theme] textarea::placeholder,
html[data-bmm-resolved-theme] .content input::placeholder, html[data-bmm-resolved-theme] .content textarea::placeholder { color:var(--bmm-ui-muted)!important; opacity:.9!important; }
html[data-bmm-resolved-theme] select option { background:var(--bmm-ui-surface)!important; color:var(--bmm-ui-text)!important; }
html[data-bmm-resolved-theme] input[type=checkbox], html[data-bmm-resolved-theme] input[type=radio] { accent-color:var(--bmm-ui-link)!important; }
/* Buttons, pills, status tags and category chips. */
html[data-bmm-resolved-theme="light"] .content :is(.btn-soft,.icon-btn,.btn-outline,.btn-ghost,.filter-chip,.chip,.pill,.audit-badge,.member-instrument-chip,.category-chip,.event-chip,.march-chip,.status-pill,.event-status,.tag,.event-datebox,.filter-badge,.report-count,.group-count) { background:#e8f0e4!important; color:#1c5637!important; border-color:#cadac8!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.btn-soft,.icon-btn,.btn-outline,.btn-ghost,.filter-chip,.chip,.pill,.audit-badge,.member-instrument-chip,.category-chip,.event-chip,.march-chip,.status-pill,.event-status,.tag,.event-datebox,.filter-badge,.report-count,.group-count) { background:linear-gradient(135deg,#1e3b29,#172e20)!important; color:#e3f4e7!important; border-color:#3b5c45!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.btn,.btn-soft,.icon-btn,.btn-outline,.btn-ghost) { color:#ecf5ee!important; }
html[data-bmm-resolved-theme] .btn-primary, html[data-bmm-resolved-theme] .btn-success, html[data-bmm-resolved-theme] [data-action*="save"] { color:#fffefa!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.btn-primary,.btn-success) { background:linear-gradient(120deg,#18714a,#0f5133)!important; color:#fffefa!important; border-color:#347c55!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.btn-danger,.danger,.delete-btn) { background:#51262a!important; color:#ffdfe1!important; border-color:#824148!important; }
/* Audit pass for legacy pills/cards that used white backgrounds in event and analytics components. */
html[data-bmm-resolved-theme="light"] .content :is(.timeline-march,.timeline-date,.group-stat,.author-avatar,.report-check,.quick-march-option,.quick-pick,.order-chip,.event-stat-march,.event-stat-march-info,.no-data-pill,.event-preview,.event-summary-meta,.march-row,.march-line,.member-avatar,.member-fact,.member-instrument-chip,.event-tags,.event-count,.status-badge,.status-realizado,.status-planificado,.status-sin-confirmar,.filter-select,.accordion-content,.year-accordion,.group-accordion) {
  background:linear-gradient(135deg,#fffefa,#edf4e9)!important; color:#203b2c!important; border-color:#d1dfd1!important;
}
html[data-bmm-resolved-theme="light"] .content :is(.timeline-date span,.timeline-date strong,.timeline-march,.group-stat span,.group-stat strong,.author-avatar,.report-check,.quick-march-option,.quick-pick,.order-chip,.event-stat-march,.event-stat-march-info,.no-data-pill,.event-count,.status-badge,.member-instrument-chip) { color:#244e36!important; opacity:1!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-march,.timeline-date,.group-stat,.author-avatar,.report-check,.quick-march-option,.quick-pick,.order-chip,.event-stat-march,.event-stat-march-info,.no-data-pill,.event-preview,.event-summary-meta,.march-row,.march-line,.member-avatar,.member-fact,.member-instrument-chip,.event-tags,.event-count,.status-badge,.status-realizado,.status-planificado,.status-sin-confirmar,.filter-select,.accordion-content,.year-accordion,.group-accordion) {
  background:linear-gradient(135deg,#1b3826,#12271a)!important; color:#e8f3eb!important; border-color:#3a5944!important;
}
html[data-bmm-resolved-theme="dark"] .content :is(.timeline-date span,.timeline-date strong,.timeline-march,.group-stat span,.group-stat strong,.author-avatar,.report-check,.quick-march-option,.quick-pick,.order-chip,.event-stat-march,.event-stat-march-info,.no-data-pill,.event-count,.status-badge,.member-instrument-chip) { color:#e2f1e6!important; opacity:1!important; }
html[data-bmm-resolved-theme="dark"] .content .timeline-date { background:linear-gradient(145deg,#e4efe0,#c8dec9)!important; border-color:#4a7454!important; }
html[data-bmm-resolved-theme="dark"] .content .timeline-date :is(span,strong) { color:#173629!important; }
html[data-bmm-resolved-theme="dark"] .content .status-realizado { background:#1c4a30!important; color:#d8f7e0!important; border-color:#36704c!important; }
html[data-bmm-resolved-theme="dark"] .content .status-planificado { background:#493c1e!important; color:#ffedb8!important; border-color:#806a35!important; }
html[data-bmm-resolved-theme="dark"] .content .status-sin-confirmar { background:#3a293e!important; color:#eedbfa!important; border-color:#62466a!important; }
html[data-bmm-resolved-theme="dark"] .content .bar-track { background:#243d2b!important; }
html[data-bmm-resolved-theme="light"] .content .bar-track { background:#e2eae0!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.event-accordion>summary,.year-accordion>summary,.group-accordion>summary,.bmm-more-analytics>summary) { background:linear-gradient(100deg,#142b1d,#0f2117)!important; color:#edf6ef!important; border-color:#304b39!important; }
html[data-bmm-resolved-theme="light"] .content :is(.event-accordion>summary,.year-accordion>summary,.group-accordion>summary,.bmm-more-analytics>summary) { background:linear-gradient(100deg,#f7faf4,#eaf2e6)!important; color:#173629!important; border-color:#d3dfd2!important; }
html[data-bmm-resolved-theme="dark"] :is(.modal-backdrop,.overlay,.dialog-backdrop) { background:rgba(0,8,4,.76)!important; }
html[data-bmm-resolved-theme="dark"] :is(.modal,.modal-content,.modal-header,.modal-footer,.dialog,.dialog-content,.dropdown-menu,.popover,.drawer-panel,.bmm-more-panel) { background:linear-gradient(145deg,#142b1d,#0b1d13)!important; color:#f2f7f3!important; border-color:#34523d!important; }
html[data-bmm-resolved-theme="dark"] :is(.modal,.modal-content,.dialog,.dialog-content,.dropdown-menu,.popover,.drawer-panel,.bmm-more-panel) :is(h1,h2,h3,h4,p,span,label,small,strong,li) { color:inherit; }
html[data-bmm-resolved-theme="light"] :is(.modal,.modal-content,.modal-header,.modal-footer,.dialog,.dialog-content,.dropdown-menu,.popover,.drawer-panel,.bmm-more-panel) { background:linear-gradient(145deg,#fffefa,#eff5ec)!important; color:#173629!important; border-color:#d3dfd2!important; }
html[data-bmm-resolved-theme="light"] :is(.modal,.modal-content,.dialog,.dialog-content,.dropdown-menu,.popover,.drawer-panel,.bmm-more-panel) :is(h1,h2,h3,h4,p,span,label,small,strong,li) { color:inherit; }
html[data-bmm-resolved-theme="dark"] .content :is(.report-config-grid,.report-tools,.report-selection-bar,.report-tally,.report-preview-caption,.backup-row,.add-category-row,.toolbar,.section-toolbar,.actions,.form-grid,.form-row) { background-color:transparent!important; color:#e6f1e9!important; border-color:#304b39!important; }
html[data-bmm-resolved-theme="light"] .content :is(.report-config-grid,.report-tools,.report-selection-bar,.report-tally,.report-preview-caption,.backup-row,.add-category-row,.toolbar,.section-toolbar,.actions,.form-grid,.form-row) { color:#203b2c!important; border-color:#d3dfd2!important; }
/* Tables: independent row colors and readable links in the dark theme. */
html[data-bmm-resolved-theme] .content :is(.data-table,.audit-table,table) { color:var(--bmm-ui-text)!important; border-color:var(--bmm-ui-border)!important; }
html[data-bmm-resolved-theme] .content :is(.data-table th,.audit-table th,table th) { background:var(--bmm-ui-raised)!important; color:var(--bmm-ui-muted)!important; border-color:var(--bmm-ui-border)!important; }
html[data-bmm-resolved-theme="light"] .content :is(.data-table td,.audit-table td,table td) { color:#203b2c!important; border-color:#d3dfd2!important; }
html[data-bmm-resolved-theme="light"] .content :is(.data-table tr:nth-child(even),.audit-table tr:nth-child(even),table tbody tr:nth-child(even)) { background:#f0f5ed!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.data-table td,.audit-table td,table td) { color:#eaf3ec!important; border-color:#304b39!important; }
html[data-bmm-resolved-theme="dark"] .content :is(.data-table tr:nth-child(even),.audit-table tr:nth-child(even),table tbody tr:nth-child(even)) { background:#13291c!important; }
html[data-bmm-resolved-theme="dark"] .content table a, html[data-bmm-resolved-theme="dark"] .content .data-table a { color:#a4e6b6!important; }
html[data-bmm-resolved-theme="light"] .content table a, html[data-bmm-resolved-theme="light"] .content .data-table a { color:#17643f!important; }
html[data-bmm-resolved-theme] .table-wrap, html[data-bmm-resolved-theme] .table-scroll { background:var(--bmm-ui-surface)!important; }
/* Charts and empty states. */
html[data-bmm-resolved-theme] .content :is(.bar-label,.bar-value,.chart-legend,.chart-caption,.pro-kpi-label,.pro-kpi-meta,.stat-top,.stat-foot) { color:var(--bmm-ui-muted)!important; opacity:1!important; }
html[data-bmm-resolved-theme] .content :is(.pro-kpi-value,.stat-value,.member-fact strong) { color:var(--bmm-ui-text)!important; }
html[data-bmm-resolved-theme] .content svg text, html[data-bmm-resolved-theme] .content .chart-wrap svg text,
html[data-bmm-resolved-theme] .content .chart-container svg text, html[data-bmm-resolved-theme] .content .chart-svg text,
html[data-bmm-resolved-theme] .content .pro-chart svg text, html[data-bmm-resolved-theme] .content .bar-chart svg text {
  fill:var(--bmm-ui-muted)!important; color:var(--bmm-ui-muted)!important;
}
html[data-bmm-resolved-theme="dark"] .content :is(.chart-empty,.empty-state,.empty-state-card) { background:linear-gradient(140deg,#132a1c,#0e2016)!important; color:#cbdacf!important; border-color:#304b39!important; }
html[data-bmm-resolved-theme="light"] .content :is(.chart-empty,.empty-state,.empty-state-card) { background:linear-gradient(140deg,#fffefa,#f0f5ed)!important; color:#435b4b!important; border-color:#d3dfd2!important; }
/* Login and synchronization/settings panels use the selected palette too. */
html[data-bmm-resolved-theme="dark"] .login-shell, html[data-bmm-resolved-theme="dark"] .login-card-wrap { background:#07140d!important; color:#f2f7f3!important; }
html[data-bmm-resolved-theme="dark"] .login-card { background:linear-gradient(145deg,#142b1d,#0e2016)!important; color:#f2f7f3!important; border-color:#304b39!important; }
html[data-bmm-resolved-theme="dark"] .login-card :is(h1,h2,h3,label,strong) { color:#f2f7f3!important; }
html[data-bmm-resolved-theme="dark"] .login-card p { color:#c1d1c6!important; }
html[data-bmm-resolved-theme="light"] .login-shell, html[data-bmm-resolved-theme="light"] .login-card-wrap { background:#f4f7f1!important; color:#173629!important; }
html[data-bmm-resolved-theme="light"] .login-card { background:#fffefa!important; color:#173629!important; border-color:#d3dfd2!important; }
html[data-bmm-resolved-theme="dark"] .content .pwa-install-note { background:linear-gradient(145deg,#142b1d,#0d2016)!important; color:#f2f7f3!important; border-color:#304b39!important; }
html[data-bmm-resolved-theme="dark"] .content .pwa-install-note :is(h1,h2,h3,p,span,strong,small) { color:#d4e2d8!important; opacity:1!important; }
html[data-bmm-resolved-theme="light"] .content .pwa-install-note { background:linear-gradient(145deg,#fffefa,#f0f5ed)!important; color:#173629!important; }
html[data-bmm-resolved-theme="light"] .content .pwa-install-note :is(h1,h2,h3,p,span,strong,small) { color:#40594a!important; opacity:1!important; }
/* Theme-selection cards stay consistent with the application while their preview swatches remain illustrative. */
html[data-bmm-resolved-theme="dark"] .bmm-theme-settings, html[data-bmm-resolved-theme="dark"] .bmm-theme-note { background:linear-gradient(145deg,#132a1c,#0e2016)!important; color:#f2f7f3!important; border-color:#304b39!important; }
html[data-bmm-resolved-theme="dark"] .bmm-theme-option { background:linear-gradient(145deg,#172f21,#102218)!important; color:#f2f7f3!important; border-color:#3b5944!important; }
html[data-bmm-resolved-theme="dark"] .bmm-theme-option :is(strong,small,em,span) { color:#d0e0d5!important; }
html[data-bmm-resolved-theme="dark"] .bmm-theme-option.selected { border-color:#e6cd78!important; box-shadow:0 0 0 2px rgba(230,205,120,.16)!important; }
html[data-bmm-resolved-theme="light"] .bmm-theme-settings, html[data-bmm-resolved-theme="light"] .bmm-theme-note { background:linear-gradient(145deg,#fffefa,#eef4e9)!important; color:#173629!important; border-color:#d3dfd2!important; }
html[data-bmm-resolved-theme="light"] .bmm-theme-option { background:linear-gradient(145deg,#fffefa,#eff5ec)!important; color:#173629!important; border-color:#d3dfd2!important; }
html[data-bmm-resolved-theme="light"] .bmm-theme-option :is(strong,small,em,span) { color:#435b4b!important; }
html[data-bmm-resolved-theme="light"] .bmm-theme-option.selected { border-color:#9d812a!important; box-shadow:0 0 0 2px rgba(157,129,42,.13)!important; }
/* The report preview is intentionally a white paper sheet in either theme, with dark print ink. Its surrounding UI follows the theme. */
html[data-bmm-resolved-theme] .content .report-preview-shell { background:var(--bmm-ui-surface)!important; color:var(--bmm-ui-text)!important; border-color:var(--bmm-ui-border)!important; }
html[data-bmm-resolved-theme] .content .report-doc, html[data-bmm-resolved-theme] .content #reportPreviewDocument .report-doc { background:#fff!important; background-image:none!important; color:#20382a!important; border-color:#d8e3d7!important; color-scheme:light!important; }
html[data-bmm-resolved-theme] .content .report-doc * { color:#20382a!important; opacity:1!important; text-shadow:none!important; }
html[data-bmm-resolved-theme] .content .report-doc h1 { color:#173f2b!important; }
html[data-bmm-resolved-theme] .content .report-doc h2 { color:#245c3b!important; border-color:#d8e3d7!important; }
html[data-bmm-resolved-theme] .content .report-doc th { background:#145438!important; color:#fff!important; }
html[data-bmm-resolved-theme] .content .report-doc td { background:#fff!important; color:#20382a!important; border-color:#d8e3d7!important; }
html[data-bmm-resolved-theme] .content .report-doc tr:nth-child(even) td { background:#f1f5ef!important; }
/* Floating save stays visible but must not obscure controls. */
html[data-bmm-resolved-theme="dark"] .bmm-floating-save { background:linear-gradient(130deg,#176b47,#0a3f29)!important; color:#fff!important; border-color:#e2c56b!important; box-shadow:0 9px 26px rgba(0,0,0,.36)!important; }
html[data-bmm-resolved-theme="light"] .bmm-floating-save { background:linear-gradient(130deg,#176b47,#0a4b30)!important; color:#fff!important; border-color:#b99b48!important; }
/* Print always uses a conventional white A4 sheet, independent of UI theme. */
@media print {
  html,body { background:#fff!important; color:#1b3124!important; color-scheme:light!important; }
  .sidebar,.topbar,.bmm-floating-save,.modal-backdrop { display:none!important; }
  .report-preview-shell { background:#fff!important; border:0!important; box-shadow:none!important; }
  .report-doc,.report-doc * { background-color:#fff!important; color:#20382a!important; box-shadow:none!important; }
  .report-doc th { background:#145438!important; color:#fff!important; }
}
@media (prefers-reduced-motion:reduce){ html[data-bmm-resolved-theme] *,html[data-bmm-resolved-theme] *::before,html[data-bmm-resolved-theme] *::after { transition:none!important;animation:none!important;scroll-behavior:auto!important; } }
`;
  document.head.appendChild(style);
  // Re-evaluate after any script changes the selected mode.
  window.bmmRefreshThemePaletteAudit=syncResolved;
})();

