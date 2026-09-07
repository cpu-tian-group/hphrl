const root = document.getElementById('root');

const CATEGORY_FILTERS = [
  '全部',
  '药物/抗生素',
  '天然产物',
  '氨基酸/缓冲液',
  '蛋白/酶',
  '染料/显色',
  '核酸/脂质',
  '有机合成',
  '危险化学品',
  '其他',
];

const TEMPERATURES = ['待确认', '室温', '4℃', '-20℃', '-80℃', '避光', '冷藏'];
const VIEWS = ['inventory', 'alerts', 'history', 'categories', 'settings', 'trash'];

const SAME_ORIGIN_API_HOSTS = new Set([
  'herbal-photonics-lab.wdxak.chatgpt.site',
  'localhost',
  '127.0.0.1',
]);
const API_BASE = SAME_ORIGIN_API_HOSTS.has(window.location.hostname)
  ? '/management-api'
  : 'https://lab-reagent-inventory.wdxak.chatgpt.site';

const state = {
  auth: 'loading',
  authError: '',
  loginCode: '',
  view: getInitialView(),
  reagents: [],
  activities: [],
  trash: [],
  loading: false,
  sync: 'idle',
  search: '',
  category: '全部',
  temperature: '全部',
  status: '全部',
  filtersOpen: false,
  pageSize: 60,
  modal: null,
  editingId: null,
  draft: null,
  saving: false,
  notice: null,
};

let refreshTimer = null;
let noticeTimer = null;

// Icons are the static SVG markup from the local Lucide icon set; the browser
// does not load an external library or a copied application bundle.
const ICONS = {
  flask: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  categories: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  settings: '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
  trash: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  location: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6h4"/>',
};

function icon(name, className = '') {
  return `<svg class="icon-svg ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.grid}</svg>`;
}

function getInitialView() {
  const requested = window.location.hash.replace(/^#/, '');
  return VIEWS.includes(requested) ? requested : 'inventory';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function text(value, fallback = '—') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(number(value));
}

function formatDateTime(value) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value, '刚刚');
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusClass(status) {
  if (status === '偏低') return 'status-low';
  if (status === '即将过期') return 'status-expiring';
  return 'status-full';
}

function statusLabel(status) {
  return status === '偏低' || status === '即将过期' ? status : '充足';
}

function statusBadgeClass(status) {
  if (status === '偏低') return 'low';
  if (status === '即将过期') return 'expiring';
  return '';
}

function progressPercent(reagent) {
  const stock = number(reagent.stock);
  const threshold = Math.max(number(reagent.threshold), 1);
  const ceiling = Math.max(stock, threshold * 4, 1);
  return Math.max(stock > 0 ? 6 : 0, Math.min(100, Math.round((stock / ceiling) * 100)));
}

function filteredReagents() {
  const query = state.search.trim().toLowerCase();
  return state.reagents.filter((reagent) => {
    const searchable = [
      reagent.name,
      reagent.alias,
      reagent.cas,
      reagent.location,
      reagent.supplier,
      reagent.notes,
    ]
      .map((value) => String(value ?? '').toLowerCase())
      .join(' ');
    const matchesQuery = !query || searchable.includes(query);
    const matchesCategory = state.category === '全部' || reagent.category === state.category;
    const matchesTemperature =
      state.temperature === '全部' || reagent.storageTemp === state.temperature;
    const matchesStatus = state.status === '全部' || reagent.status === state.status;
    return matchesQuery && matchesCategory && matchesTemperature && matchesStatus;
  });
}

function navItem(view, label, iconName, count = '') {
  const active = state.view === view ? 'active' : '';
  const badge = count === '' ? '' : `<span class="nav-count ${view === 'alerts' ? 'alert-count' : ''}">${escapeHtml(count)}</span>`;
  return `<button class="nav-item ${active}" type="button" data-view="${view}">
    <span class="nav-icon">${icon(iconName)}</span>
    <span>${label}</span>
    ${badge}
  </button>`;
}

function renderAuth() {
  const loading = state.auth === 'loading';
  root.innerHTML = `<main class="auth-shell">
    <section class="auth-card ${loading ? 'loading-card' : ''}" aria-labelledby="auth-title">
      <div class="auth-mark">${icon('flask', 'mark-icon')}</div>
      <p class="auth-kicker">LABSTOCK · GROUP ACCESS</p>
      <h1 id="auth-title">进入课题组试剂库</h1>
      ${loading
        ? `<p class="auth-copy">正在检查访问状态...</p>
           <div class="loading-label" aria-live="polite"><span class="loading-spinner"></span>正在连接共享试剂库</div>`
        : `<p class="auth-copy">输入课题组密码后即可查看和管理共享试剂。</p>
           <form class="auth-form" data-login-form>
             <label class="form-label" for="login-code">课题组密码</label>
             <div class="input-wrap">
               <input id="login-code" name="code" type="password" autocomplete="current-password" placeholder="请输入密码" value="${escapeHtml(state.loginCode)}" required />
             </div>
             ${state.authError ? `<p class="auth-error" role="alert">${escapeHtml(state.authError)}</p>` : ''}
             <button class="auth-submit" type="submit" ${state.saving ? 'disabled' : ''}>进入试剂库</button>
           </form>`}
      <p class="auth-footnote">仅限课题组成员使用 · 数据实时共享</p>
    </section>
  </main>`;
}

function renderTopbar() {
  const syncLabel =
    state.sync === 'syncing'
      ? '同步中'
      : state.sync === 'offline'
        ? '连接异常'
        : '实时同步';
  const syncClass = state.sync === 'offline' ? 'offline' : state.sync === 'syncing' ? 'syncing' : '';
  return `<header class="app-topbar">
    <a class="app-brand" href="#inventory" data-view="inventory" aria-label="返回试剂库">
      <span class="brand-mark">${icon('flask', 'mark-icon')}</span>
      <span class="brand-copy"><strong>LabStock</strong><small>tianlab</small></span>
    </a>
    <div class="topbar-actions">
      <span class="sync-chip ${syncClass}"><span class="sync-dot"></span>${syncLabel}</span>
      <button class="icon-button" type="button" data-action="refresh" aria-label="刷新数据" title="刷新数据">${icon('refresh')}</button>
      <button class="avatar-button" type="button" data-action="logout" aria-label="退出试剂库" title="退出试剂库">W</button>
    </div>
  </header>`;
}

function renderSidebar() {
  const lowCount = state.reagents.filter((item) => item.status === '偏低').length;
  const expiringCount = state.reagents.filter((item) => item.status === '即将过期').length;
  const alertCount = lowCount + expiringCount;
  return `<aside class="app-sidebar" aria-label="试剂库导航">
    <section class="sidebar-section">
      <p class="sidebar-label">WORKSPACE</p>
      <div class="sidebar-links">
        ${navItem('inventory', '试剂库', 'grid', state.reagents.length)}
        ${navItem('alerts', '库存提醒', 'alert', alertCount)}
        ${navItem('history', '操作记录', 'history')}
      </div>
    </section>
    <section class="sidebar-section">
      <p class="sidebar-label">TOOLS</p>
      <div class="sidebar-links">
        ${navItem('categories', '分类管理', 'categories')}
        ${navItem('settings', '设置', 'settings')}
        ${navItem('trash', '回收站', 'trash', state.trash.length)}
      </div>
    </section>
  </aside>`;
}

function renderMobileNav() {
  const lowCount = state.reagents.filter((item) => item.status === '偏低').length;
  const expiringCount = state.reagents.filter((item) => item.status === '即将过期').length;
  return `<nav class="mobile-bottom-nav" aria-label="移动端导航">
    ${navItem('inventory', '试剂库', 'grid', state.reagents.length)}
    ${navItem('alerts', '提醒', 'alert', lowCount + expiringCount)}
    ${navItem('categories', '分类', 'categories')}
    ${navItem('history', '记录', 'history')}
    ${navItem('settings', '设置', 'settings')}
    ${navItem('trash', '回收站', 'trash', state.trash.length)}
  </nav>`;
}

function renderStatCard(label, value, suffix, caption, iconName, variant = '') {
  return `<article class="stat-card ${variant}">
    <div class="stat-top"><span><span class="stat-icon">${icon(iconName)}</span>${label}</span><span class="stat-caption">${caption}</span></div>
    <div class="stat-value"><strong>${formatNumber(value)}</strong><span>${suffix}</span></div>
  </article>`;
}

function renderSearchPanel() {
  return `<div class="search-panel">
    <div class="search-row">
      <span class="search-glyph">${icon('search')}</span>
      <input id="inventory-search" class="search-input" type="search" value="${escapeHtml(state.search)}" placeholder="搜索名称、CAS号、位置或供应商..." autocomplete="off" aria-label="搜索试剂" />
      <button class="text-button" type="button" data-action="toggle-filters">${state.filtersOpen ? '收起筛选' : '筛选'}</button>
    </div>
    <div class="category-tabs" role="tablist" aria-label="试剂分类">
      ${CATEGORY_FILTERS.map(
        (category) => `<button class="category-tab ${state.category === category ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}" role="tab" aria-selected="${state.category === category}">${escapeHtml(category)}</button>`,
      ).join('')}
    </div>
    ${state.filtersOpen
      ? `<div class="filter-panel">
          ${selectField('保存条件', 'temperature-filter', ['全部', ...TEMPERATURES], state.temperature)}
          ${selectField('库存状态', 'status-filter', ['全部', '充足', '偏低', '即将过期'], state.status)}
        </div>`
      : ''}
  </div>`;
}

function selectField(label, id, options, selected) {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-filter="${id}">${options
    .map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? 'selected' : ''}>${escapeHtml(option)}</option>`)
    .join('')}</select></div>`;
}

function renderReagentCard(reagent) {
  const danger = reagent.category === '危险化学品';
  const location = text(reagent.location, '待分配');
  const status = statusLabel(reagent.status);
  return `<article class="reagent-card ${statusClass(reagent.status)}">
    <div class="reagent-card-top">
      <span class="tag ${danger ? 'danger' : ''}">${escapeHtml(reagent.category || '其他')}</span>
      <span class="status-pill ${statusBadgeClass(reagent.status)}">${escapeHtml(status)}</span>
    </div>
    <div class="reagent-title-row">
      <h3 title="${escapeHtml(reagent.name)}">${escapeHtml(reagent.name)}</h3>
      <div class="card-actions">
        <button class="small-action" type="button" data-edit="${reagent.id}">编辑</button>
        <button class="small-action delete" type="button" data-delete="${reagent.id}">删除</button>
      </div>
    </div>
    <p class="reagent-alias">${escapeHtml(text(reagent.alias, '暂无别名'))}</p>
    <div class="location-row">
      <span class="location-label"><span>${icon('location')}</span>保存位置</span>
      <strong class="location-value" title="${escapeHtml(location)}">${escapeHtml(location)}</strong>
    </div>
    <div class="card-meta-row"><span>CAS ${escapeHtml(text(reagent.cas, '待补充'))}</span><strong>${escapeHtml(text(reagent.updated, '刚刚'))}</strong></div>
    <div class="progress-label"><span>当前库存</span><strong>${formatNumber(reagent.stock)} ${escapeHtml(text(reagent.unit, '瓶'))}</strong></div>
    <div class="progress-track" aria-label="库存进度"><div class="progress-bar" style="width:${progressPercent(reagent)}%"></div></div>
  </article>`;
}

function renderInventory() {
  const lowCount = state.reagents.filter((item) => item.status === '偏低').length;
  const expiringCount = state.reagents.filter((item) => item.status === '即将过期').length;
  const filtered = filteredReagents();
  const visible = filtered.slice(0, state.pageSize);
  const pendingInfo = state.reagents.filter(
    (item) => text(item.expiry, '') === '待录入' || text(item.supplier, '') === '待补充',
  ).length;
  return `<div class="content-shell">
    <div class="page-heading">
      <div><p class="eyebrow">LAB INVENTORY / 2026.09</p><h1>今天要找什么试剂？</h1><p>快速查看库存、定位存放位置，减少在实验室里反复寻找的时间。</p></div>
      <button class="btn-primary" type="button" data-action="add"><span class="plus">${icon('plus')}</span>新增试剂</button>
    </div>
    <div class="stats-grid">
      ${renderStatCard('试剂总数', state.reagents.length, '项', pendingInfo ? `${pendingInfo} 项待补充信息` : '共享库存', 'grid')}
      ${renderStatCard('库存偏低', lowCount, '项', '需要补货', 'alert', 'warn')}
      ${renderStatCard('临近有效期', expiringCount, '项', '30 天内', 'clock', 'danger')}
    </div>
    <section aria-labelledby="inventory-title">
      <div class="section-heading"><div><h2 id="inventory-title">全部试剂</h2><p>${filtered.length} 项结果 · 按位置与保存条件查看</p></div><button class="text-button" type="button" data-action="toggle-filters">☷ ${state.filtersOpen ? '收起筛选' : '筛选'}</button></div>
      ${renderSearchPanel()}
      ${state.loading && state.reagents.length === 0
        ? `<div class="loading-state"><div><span class="loading-spinner"></span><p>正在加载共享试剂库...</p></div></div>`
        : state.sync === 'offline' && state.reagents.length === 0
          ? `<div class="offline-state"><div><strong>暂时无法连接共享试剂库</strong><p>请检查网络后点击右上角刷新，或稍后再试。</p></div></div>`
          : visible.length
            ? `<div class="reagent-grid">${visible.map(renderReagentCard).join('')}</div>${filtered.length > visible.length ? `<div class="load-more-wrap"><button class="text-button" type="button" data-action="load-more">继续加载（已显示 ${visible.length} 项）</button></div>` : ''}`
            : `<div class="empty-state"><div><strong>没有找到匹配的试剂</strong><p>可以换一个名称、CAS 号、位置或供应商关键词。</p></div></div>`}
    </section>
  </div>`;
}

function renderAlertRow(reagent) {
  const detail = reagent.status === '偏低'
    ? `当前库存 ${formatNumber(reagent.stock)} ${text(reagent.unit, '瓶')} · 阈值 ${formatNumber(reagent.threshold)}`
    : `有效期 ${text(reagent.expiry, '待录入')} · 保存位置 ${text(reagent.location, '待分配')}`;
  return `<div class="alert-row"><div class="row-main"><strong>${escapeHtml(reagent.name)}</strong><span>${escapeHtml(detail)}</span></div><div class="row-side"><span class="status-pill ${statusBadgeClass(reagent.status)}">${escapeHtml(statusLabel(reagent.status))}</span><button class="small-action" type="button" data-edit="${reagent.id}">编辑</button></div></div>`;
}

function renderAlerts() {
  const low = state.reagents.filter((item) => item.status === '偏低');
  const expiring = state.reagents.filter((item) => item.status === '即将过期');
  const all = [...low, ...expiring];
  return `<div class="content-shell">
    <div class="page-heading"><div><p class="eyebrow">STOCK ALERTS</p><h1>库存提醒</h1><p>优先处理库存偏低和 30 天内即将到期的试剂。</p></div><button class="btn-primary" type="button" data-action="refresh">${icon('refresh')} 刷新数据</button></div>
    ${all.length ? `<section class="view-card"><h2>需要关注的试剂</h2><p>共 ${all.length} 项提醒，点击编辑可以直接补充库存或有效期。</p><div class="alert-list">${all.map(renderAlertRow).join('')}</div></section>` : `<div class="empty-state"><div><strong>目前没有库存提醒</strong><p>库存状态正常，后续数据变化会自动同步到这里。</p></div></div>`}
  </div>`;
}

function activityIcon(action) {
  if (action === '新增') return icon('plus');
  if (action === '编辑') return icon('settings');
  if (action === '恢复') return icon('history');
  if (action === '彻底删除') return icon('trash');
  return icon('grid');
}

function renderHistory() {
  return `<div class="content-shell">
    <div class="page-heading"><div><p class="eyebrow">ACTIVITY LOG</p><h1>操作记录</h1><p>记录共享试剂库的新增、编辑、回收和恢复操作。</p></div><button class="btn-primary" type="button" data-action="refresh">${icon('refresh')} 刷新记录</button></div>
    <section class="view-card"><h2>最近操作</h2><p>最新记录会在每次数据同步后更新。</p>
      ${state.activities.length ? `<div class="activity-list">${state.activities.map((activity) => `<div class="activity-row"><span class="activity-marker" aria-hidden="true">${activityIcon(activity.action)}</span><div class="row-main"><strong>${escapeHtml(text(activity.action, '操作'))} · ${escapeHtml(text(activity.reagentName, '未命名试剂'))}</strong><span class="activity-summary">${escapeHtml(text(activity.summary, '共享试剂库发生了一次更新'))}</span></div><div class="activity-meta">${escapeHtml(formatDateTime(activity.createdAt))}<span>${escapeHtml(text(activity.userEmail, '共享成员'))}</span></div></div>`).join('')}</div>` : `<div class="empty-state"><div><strong>还没有操作记录</strong><p>新增或编辑试剂后，记录会显示在这里。</p></div></div>`}
    </section>
  </div>`;
}

function renderCategories() {
  const counts = new Map(CATEGORY_FILTERS.slice(1).map((category) => [category, 0]));
  state.reagents.forEach((reagent) => counts.set(reagent.category, (counts.get(reagent.category) ?? 0) + 1));
  return `<div class="content-shell">
    <div class="page-heading"><div><p class="eyebrow">CATEGORY DIRECTORY</p><h1>分类管理</h1><p>按试剂类型查看当前共享库存，选择分类即可跳转到试剂库。</p></div><button class="btn-primary" type="button" data-action="add"><span class="plus">${icon('plus')}</span>新增试剂</button></div>
    <div class="category-grid">${CATEGORY_FILTERS.slice(1).map((category) => `<button class="category-card" type="button" data-category="${escapeHtml(category)}"><strong>${escapeHtml(category)}</strong><span>${formatNumber(counts.get(category) ?? 0)}</span><small>项试剂 · 点击查看</small></button>`).join('')}</div>
  </div>`;
}

function renderSettings() {
  const lowCount = state.reagents.filter((item) => item.status === '偏低').length;
  const expiringCount = state.reagents.filter((item) => item.status === '即将过期').length;
  return `<div class="content-shell">
    <div class="page-heading"><div><p class="eyebrow">WORKSPACE SETTINGS</p><h1>设置</h1><p>查看当前共享空间和同步状态。</p></div><button class="btn-primary" type="button" data-action="refresh">${icon('refresh')} 立即同步</button></div>
    <div class="settings-grid">
      <section class="view-card"><h2>共享空间</h2><p>输入课题组密码的成员都可以管理这份库存。</p><div class="settings-row"><span>访问方式</span><strong>课题组密码</strong></div><div class="settings-row"><span>成员权限</span><strong>可查看、新增、编辑、删除</strong></div><div class="settings-row"><span>实时数据</span><strong class="settings-status">${state.sync === 'offline' ? '连接异常' : '已连接'}</strong></div></section>
      <section class="view-card"><h2>库存概览</h2><p>当前共享数据的快速统计。</p><div class="settings-row"><span>试剂总数</span><strong>${formatNumber(state.reagents.length)} 项</strong></div><div class="settings-row"><span>库存偏低</span><strong>${formatNumber(lowCount)} 项</strong></div><div class="settings-row"><span>临近有效期</span><strong>${formatNumber(expiringCount)} 项</strong></div><div class="settings-row"><span>回收站</span><strong>${formatNumber(state.trash.length)} 项</strong></div></section>
    </div>
    <section class="view-card danger-card"><h2>退出当前空间</h2><p>退出后需要再次输入课题组密码才能查看共享试剂库。</p><div class="modal-footer"><button class="btn-danger" type="button" data-action="logout">退出试剂库</button></div></section>
  </div>`;
}

function renderTrash() {
  return `<div class="content-shell">
    <div class="page-heading"><div><p class="eyebrow">TRASH</p><h1>回收站</h1><p>误删的试剂可以恢复；永久删除后将无法找回。</p></div><button class="btn-primary" type="button" data-action="refresh">${icon('refresh')} 刷新回收站</button></div>
    <section class="view-card"><h2>已移入回收站</h2><p>${state.trash.length} 项记录</p>
      ${state.trash.length ? `<div class="trash-list">${state.trash.map((reagent) => `<div class="trash-row"><div class="row-main"><strong>${escapeHtml(reagent.name)}</strong><span>${escapeHtml(text(reagent.location, '待分配'))} · 删除于 ${escapeHtml(formatDateTime(reagent.deletedAt))}</span></div><div class="row-side"><button class="small-action" type="button" data-restore="${reagent.id}">恢复</button><button class="small-action delete" type="button" data-permanent="${reagent.id}">永久删除</button></div></div>`).join('')}</div>` : `<div class="empty-state"><div><strong>回收站是空的</strong><p>删除的试剂会先保留在这里，方便恢复。</p></div></div>`}
    </section>
  </div>`;
}

function renderView() {
  if (state.view === 'alerts') return renderAlerts();
  if (state.view === 'history') return renderHistory();
  if (state.view === 'categories') return renderCategories();
  if (state.view === 'settings') return renderSettings();
  if (state.view === 'trash') return renderTrash();
  return renderInventory();
}

function draftValue(key, fallback = '') {
  return escapeHtml(state.draft?.[key] ?? fallback);
}

function renderModal() {
  if (!state.modal) return '';
  if (state.modal === 'reagent') {
    const editing = state.editingId !== null;
    return `<div class="modal-backdrop" data-modal-backdrop>
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reagent-modal-title">
        <div class="modal-heading"><div><h2 id="reagent-modal-title">${editing ? '编辑试剂' : '新增试剂'}</h2><p>${editing ? '修改后会同步到所有成员的设备。' : '新增后，所有成员都能看到这条库存记录。'}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div>
        <form data-reagent-form>
          <div class="form-grid">
            ${inputField('试剂名称', 'name', '请输入试剂名称', draftValue('name'), true)}
            ${inputField('别名', 'alias', '可填写英文名或常用简称', draftValue('alias'))}
            ${inputField('CAS 号', 'cas', '例如 50-00-0', draftValue('cas'))}
            ${selectField('分类', 'reagent-category', CATEGORY_FILTERS.slice(1), state.draft?.category || '其他')}
            ${inputField('存放位置', 'location', '例如 试剂柜第五层 · 第一列 · 第16格', draftValue('location'), true)}
            ${selectField('保存条件', 'storageTemp', TEMPERATURES, state.draft?.storageTemp || '待确认')}
            ${inputField('当前库存', 'stock', '填写数字', draftValue('stock', '0'), false, 'number', '0', '0.01')}
            ${inputField('单位', 'unit', '瓶、盒、管等', draftValue('unit', '瓶'))}
            ${inputField('供应商', 'supplier', '可暂时留空', draftValue('supplier'))}
            ${inputField('有效期', 'expiry', '留空表示待录入', draftValue('expiry') === '待录入' ? '' : draftValue('expiry'), false, 'date')}
            ${textareaField('备注', 'notes', '补充危险性、盘点或使用说明', draftValue('notes'), true)}
          </div>
          ${state.authError && state.saving ? `<p class="inline-error" role="alert">${escapeHtml(state.authError)}</p>` : ''}
          <div class="modal-footer"><button class="btn-secondary" type="button" data-action="close-modal">取消</button><button class="btn-primary" type="submit" ${state.saving ? 'disabled' : ''}>${state.saving ? '保存中...' : editing ? '保存修改' : '加入试剂库'}</button></div>
        </form>
      </section>
    </div>`;
  }

  const reagent = state.reagents.find((item) => item.id === state.editingId) || state.trash.find((item) => item.id === state.editingId);
  const permanent = state.modal === 'permanent';
  return `<div class="modal-backdrop" data-modal-backdrop>
    <section class="modal-card confirm-card" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <div class="modal-heading"><div><h2 id="confirm-modal-title">${permanent ? '永久删除这条记录？' : '移入回收站？'}</h2><p>${permanent ? '永久删除后将无法恢复，请确认这条记录已经不再需要。' : '记录会暂时保留在回收站，之后仍可以恢复。'}</p></div><button class="modal-close" type="button" data-action="close-modal" aria-label="关闭">×</button></div>
      <p class="confirm-copy">试剂：<strong>${escapeHtml(text(reagent?.name, '未命名试剂'))}</strong></p>
      <div class="modal-footer"><button class="btn-secondary" type="button" data-action="close-modal">取消</button><button class="${permanent ? 'btn-danger' : 'btn-primary'}" type="button" data-action="confirm-delete">${permanent ? '永久删除' : '移入回收站'}</button></div>
    </section>
  </div>`;
}

function inputField(label, name, placeholder, value = '', required = false, type = 'text', min = '', step = '') {
  const attributes = [
    `id="field-${name}"`,
    `name="${name}"`,
    `type="${type}"`,
    `value="${value}"`,
    `placeholder="${escapeHtml(placeholder)}"`,
  ];
  if (required) attributes.push('required');
  if (min !== '') attributes.push(`min="${min}"`);
  if (step !== '') attributes.push(`step="${step}"`);
  return `<div class="field"><label for="field-${name}">${label}${required ? ' <em>*</em>' : ''}</label><input ${attributes.join(' ')} /></div>`;
}

function textareaField(label, name, placeholder, value = '', full = false) {
  return `<div class="field ${full ? 'full' : ''}"><label for="field-${name}">${label}</label><textarea id="field-${name}" name="${name}" placeholder="${escapeHtml(placeholder)}">${value}</textarea></div>`;
}

function renderNotice() {
  if (!state.notice) return '';
  return `<div class="toast ${state.notice.type === 'error' ? 'error' : ''}" role="status">${escapeHtml(state.notice.message)}</div>`;
}

function renderApp(preserveFocus = true) {
  const active = preserveFocus && document.activeElement?.id ? {
    id: document.activeElement.id,
    start: typeof document.activeElement.selectionStart === 'number' ? document.activeElement.selectionStart : null,
    end: typeof document.activeElement.selectionEnd === 'number' ? document.activeElement.selectionEnd : null,
  } : null;
  root.innerHTML = `<div class="management-app">
    ${renderTopbar()}
    <div class="app-body">
      ${renderSidebar()}
      <main class="app-main">${renderView()}</main>
    </div>
    ${renderMobileNav()}
    ${renderModal()}
    ${renderNotice()}
  </div>`;
  if (active) {
    const next = document.getElementById(active.id);
    if (next) {
      next.focus({ preventScroll: true });
      if (active.start !== null && typeof next.setSelectionRange === 'function') {
        next.setSelectionRange(active.start, active.end);
      }
    }
  }
}

function render() {
  if (state.auth !== 'authorized') renderAuth();
  else renderApp();
}

function changeView(view) {
  if (!VIEWS.includes(view)) return;
  state.view = view;
  state.modal = null;
  state.editingId = null;
  window.history.replaceState(null, '', `#${view}`);
  renderApp();
}

function setNotice(message, type = 'success') {
  window.clearTimeout(noticeTimer);
  state.notice = { message, type };
  renderApp();
  noticeTimer = window.setTimeout(() => {
    state.notice = null;
    renderApp();
  }, 3200);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function getWithRetry(path) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await apiRequest(path);
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 400));
    }
  }
  throw lastError;
}

async function checkAccess() {
  const payload = await getWithRetry('/api/access');
  return Boolean(payload.authenticated);
}

async function loadData({ manual = false } = {}) {
  if (state.auth !== 'authorized') return;
  state.loading = true;
  state.sync = 'syncing';
  if (manual || state.reagents.length === 0) renderApp();
  try {
    const [reagentResult, activityResult, trashResult] = await Promise.allSettled([
      getWithRetry('/api/reagents'),
      getWithRetry('/api/activity?limit=100'),
      getWithRetry('/api/trash?limit=200'),
    ]);
    if (reagentResult.status === 'rejected') throw reagentResult.reason;
    if (reagentResult.value && Array.isArray(reagentResult.value.reagents)) state.reagents = reagentResult.value.reagents;
    state.activities = activityResult.status === 'fulfilled' && Array.isArray(activityResult.value.activities) ? activityResult.value.activities : [];
    state.trash = trashResult.status === 'fulfilled' && Array.isArray(trashResult.value.reagents) ? trashResult.value.reagents : [];
    state.sync = 'ready';
    state.loading = false;
    renderApp();
  } catch (error) {
    state.loading = false;
    state.sync = 'offline';
    if (error?.status === 401) {
      state.auth = 'locked';
      state.authError = '登录状态已过期，请重新输入课题组密码。';
      stopPolling();
      renderAuth();
      return;
    }
    if (manual) setNotice(error instanceof Error ? error.message : '共享试剂库暂时不可用', 'error');
    else renderApp();
  }
}

function startPolling() {
  stopPolling();
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && state.auth === 'authorized' && !state.modal) {
      void loadData();
    }
  }, 10000);
}

function stopPolling() {
  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = null;
}

async function handleLogin(form) {
  const data = new FormData(form);
  const code = String(data.get('code') || '').trim();
  state.loginCode = code;
  if (!code) {
    state.authError = '请输入课题组密码。';
    renderAuth();
    return;
  }
  state.saving = true;
  state.authError = '';
  renderAuth();
  try {
    const payload = await apiRequest('/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!payload.authenticated) throw new Error('密码验证失败，请重试。');
    state.auth = 'authorized';
    state.loginCode = '';
    state.saving = false;
    state.authError = '';
    renderApp(false);
    startPolling();
    await loadData();
  } catch (error) {
    state.saving = false;
    state.auth = 'locked';
    state.authError = error instanceof Error ? error.message : '密码验证失败，请稍后重试。';
    renderAuth();
    const input = document.getElementById('login-code');
    if (input) input.focus();
  }
}

async function logout() {
  await apiRequest('/api/access', { method: 'DELETE' }).catch(() => undefined);
  stopPolling();
  state.auth = 'locked';
  state.authError = '';
  state.loginCode = '';
  state.reagents = [];
  state.activities = [];
  state.trash = [];
  state.modal = null;
  state.sync = 'idle';
  renderAuth();
}

function openAdd() {
  state.modal = 'reagent';
  state.editingId = null;
  state.authError = '';
  state.draft = {
    name: '',
    alias: '',
    cas: '',
    category: '其他',
    location: '',
    storageTemp: '待确认',
    stock: '0',
    unit: '瓶',
    supplier: '',
    expiry: '',
    notes: '',
  };
  renderApp(false);
  document.getElementById('field-name')?.focus();
}

function openEdit(id) {
  const reagent = state.reagents.find((item) => item.id === Number(id));
  if (!reagent) return;
  state.modal = 'reagent';
  state.editingId = reagent.id;
  state.authError = '';
  state.draft = {
    name: text(reagent.name, ''),
    alias: reagent.alias === '—' ? '' : text(reagent.alias, ''),
    cas: reagent.cas === '—' ? '' : text(reagent.cas, ''),
    category: CATEGORY_FILTERS.includes(reagent.category) ? reagent.category : '其他',
    location: reagent.location === '待分配' ? '' : text(reagent.location, ''),
    storageTemp: text(reagent.storageTemp, '待确认'),
    stock: String(number(reagent.stock)),
    unit: text(reagent.unit, '瓶'),
    supplier: ['待补充', '—'].includes(reagent.supplier) ? '' : text(reagent.supplier, ''),
    expiry: ['待录入', '未录入'].includes(reagent.expiry) ? '' : text(reagent.expiry, ''),
    notes: ['暂无备注。', '—'].includes(reagent.notes) ? '' : text(reagent.notes, ''),
  };
  renderApp(false);
  document.getElementById('field-name')?.focus();
}

function openDelete(id, permanent = false) {
  state.editingId = Number(id);
  state.modal = permanent ? 'permanent' : 'delete';
  state.authError = '';
  renderApp(false);
}

function closeModal() {
  state.modal = null;
  state.editingId = null;
  state.draft = null;
  state.saving = false;
  state.authError = '';
  renderApp();
}

function formPayload(form) {
  const data = new FormData(form);
  const stock = Number(data.get('stock'));
  return {
    name: String(data.get('name') || '').trim(),
    alias: String(data.get('alias') || '').trim(),
    cas: String(data.get('cas') || '').trim(),
    category: String(data.get('reagent-category') || '其他'),
    location: String(data.get('location') || '').trim(),
    storageTemp: String(data.get('storageTemp') || '待确认'),
    stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
    unit: String(data.get('unit') || '瓶').trim() || '瓶',
    supplier: String(data.get('supplier') || '').trim(),
    expiry: String(data.get('expiry') || '').trim(),
    notes: String(data.get('notes') || '').trim(),
  };
}

async function saveReagent(form) {
  const payload = formPayload(form);
  if (!payload.name) {
    state.authError = '请填写试剂名称。';
    renderApp(true);
    return;
  }
  if (!payload.location && state.editingId === null) {
    state.authError = '请填写存放位置，方便成员查找。';
    renderApp(true);
    return;
  }
  state.saving = true;
  state.authError = '';
  renderApp(true);
  try {
    const path = state.editingId === null ? '/api/reagents' : `/api/reagents/${state.editingId}`;
    const payloadResult = await apiRequest(path, {
      method: state.editingId === null ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!payloadResult.reagent) throw new Error('试剂保存后无法读取');
    state.modal = null;
    state.draft = null;
    state.saving = false;
    await loadData();
    setNotice(state.editingId === null ? '试剂已加入共享试剂库。' : '试剂信息已更新，所有成员都能看到。');
    state.editingId = null;
  } catch (error) {
    state.saving = false;
    state.authError = error instanceof Error ? error.message : '保存试剂失败，请稍后重试。';
    if (error?.status === 401) {
      state.auth = 'locked';
      stopPolling();
      renderAuth();
    } else {
      renderApp(true);
    }
  }
}

async function confirmDelete() {
  const id = state.editingId;
  if (!id) return;
  const permanent = state.modal === 'permanent';
  state.saving = true;
  renderApp(false);
  try {
    await apiRequest(permanent ? `/api/trash/${id}` : `/api/reagents/${id}`, { method: 'DELETE' });
    state.modal = null;
    state.editingId = null;
    state.saving = false;
    await loadData();
    setNotice(permanent ? '记录已永久删除。' : '试剂已移入回收站。');
  } catch (error) {
    state.saving = false;
    if (error?.status === 401) {
      state.auth = 'locked';
      stopPolling();
      renderAuth();
    } else {
      state.authError = error instanceof Error ? error.message : '删除失败，请稍后重试。';
      renderApp(false);
    }
  }
}

async function restoreReagent(id) {
  try {
    await apiRequest(`/api/reagents/${id}/restore`, { method: 'POST' });
    await loadData();
    setNotice('试剂已恢复到共享试剂库。');
  } catch (error) {
    setNotice(error instanceof Error ? error.message : '恢复失败，请稍后重试。', 'error');
  }
}

root.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const viewButton = target.closest('[data-view]');
  if (viewButton) {
    event.preventDefault();
    changeView(viewButton.dataset.view);
    return;
  }
  const categoryButton = target.closest('[data-category]');
  if (categoryButton) {
    state.category = categoryButton.dataset.category || '全部';
    state.pageSize = 60;
    if (state.view !== 'inventory') state.view = 'inventory';
    window.history.replaceState(null, '', '#inventory');
    renderApp();
    return;
  }
  if (target.closest('[data-modal-backdrop]') === target) {
    closeModal();
    return;
  }
  const actionButton = target.closest('[data-action]');
  const action = actionButton?.dataset.action;
  if (action === 'add') return openAdd();
  if (action === 'refresh') return void loadData({ manual: true });
  if (action === 'logout') return void logout();
  if (action === 'toggle-filters') {
    state.filtersOpen = !state.filtersOpen;
    renderApp();
    return;
  }
  if (action === 'load-more') {
    state.pageSize += 60;
    renderApp();
    return;
  }
  if (action === 'close-modal') return closeModal();
  if (action === 'confirm-delete') return void confirmDelete();
  const editButton = target.closest('[data-edit]');
  if (editButton) return openEdit(editButton.dataset.edit);
  const deleteButton = target.closest('[data-delete]');
  if (deleteButton) return openDelete(deleteButton.dataset.delete);
  const restoreButton = target.closest('[data-restore]');
  if (restoreButton) return void restoreReagent(restoreButton.dataset.restore);
  const permanentButton = target.closest('[data-permanent]');
  if (permanentButton) return openDelete(permanentButton.dataset.permanent, true);
});

root.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === 'login-code') {
    state.loginCode = target.value;
    return;
  }
  if (target.id === 'inventory-search') {
    state.search = target.value;
    state.pageSize = 60;
    renderApp();
  }
});

root.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  if (target.dataset.filter === 'temperature-filter') state.temperature = target.value;
  if (target.dataset.filter === 'status-filter') state.status = target.value;
  renderApp();
});

root.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.matches('[data-login-form]')) void handleLogin(form);
  if (form.matches('[data-reagent-form]')) void saveReagent(form);
});

root.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.modal) closeModal();
});

window.addEventListener('hashchange', () => {
  const view = getInitialView();
  if (view !== state.view && state.auth === 'authorized') changeView(view);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.auth === 'authorized') void loadData();
});

async function boot() {
  renderAuth();
  try {
    const authenticated = await checkAccess();
    state.auth = authenticated ? 'authorized' : 'locked';
    state.authError = '';
    render();
    if (authenticated) {
      startPolling();
      await loadData();
    }
  } catch (error) {
    state.auth = 'locked';
    state.authError = '共享试剂库暂时无法连接，请检查网络后重试。';
    renderAuth();
  }
}

void boot();
