const API_BASE = 'https://tianlab-lab-management-api.2442148683.workers.dev';
const SESSION_KEY = 'tianlab_management_session_token';
const root = document.getElementById('management-root');
const categories = ['全部', '药物/抗生素', '天然产物', '氨基酸/缓冲液', '蛋白/酶', '染料/显色', '核酸/脂质', '有机合成', '危险化学品', '其他'];
const temperatures = ['待确认', '室温', '4℃', '-20℃', '-80℃', '避光', '冷藏'];

const state = {
  authenticated: null,
  reagents: [],
  activities: [],
  query: '',
  category: '全部',
  modal: null,
  notice: null,
  noticeTimer: null,
  sync: 'idle',
  passwordVisible: false,
};

const ICONS = {
  flask: '<path d="M14 2v6a2 2 0 0 0 .25.96l5.5 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.75-2.96l5.5-10.08A2 2 0 0 0 10 8V2"/><path d="M6.5 15h11"/><path d="M8.5 2h7"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m20 20-3.7-3.7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-13.7-5.7L4 7.5"/><path d="M4 3.5v4h4"/><path d="M4 13a8 8 0 0 0 13.7 5.7l2.3-2.2"/><path d="M20 20.5v-4h-4"/>',
  eye: '<path d="M2.5 12s3.2-5 9.5-5 9.5 5 9.5 5-3.2 5-9.5 5-9.5-5-9.5-5Z"/><circle cx="12" cy="12" r="2.2"/>',
  eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6.3 0 9.5 6 9.5 6a16.5 16.5 0 0 1-3 3.5M6.2 6.7C3.8 8.2 2.5 12 2.5 12s3.2 6 9.5 6c1.1 0 2.1-.2 3-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  pin: '<path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return '未填写有效期';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

function dateStatus(value) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`).getTime();
  const days = Math.ceil((target - new Date(new Date().toDateString()).getTime()) / 86400000);
  return days >= 0 && days <= 30 ? '即将到期' : null;
}

function reagentStatus(reagent) {
  if (dateStatus(reagent.expiry)) return '即将到期';
  if (Number(reagent.minQuantity) > 0 && Number(reagent.quantity) <= Number(reagent.minQuantity)) return '库存偏低';
  return '库存充足';
}

function visibleReagents() {
  const query = state.query.trim().toLowerCase();
  return state.reagents.filter((reagent) => {
    const searchable = [reagent.name, reagent.cas, reagent.location, reagent.supplier, reagent.note].join(' ').toLowerCase();
    return (!query || searchable.includes(query)) && (state.category === '全部' || reagent.category === state.category);
  });
}

function storedSession() {
  try { return window.localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
}

function storeSession(value) {
  try {
    if (value) window.localStorage.setItem(SESSION_KEY, value);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch { /* Private browsing can disable local storage; the secure cookie remains available. */ }
}

async function request(path, options = {}) {
  const token = storedSession();
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  let payload = {};
  try { payload = await response.json(); } catch { payload = {}; }
  if (response.status === 401) {
    storeSession('');
    state.authenticated = false;
    render();
  }
  if (!response.ok) throw new Error(payload.error || '请求没有完成，请稍后重试。');
  return payload;
}

function notify(message, error = false) {
  state.notice = { message, error };
  window.clearTimeout(state.noticeTimer);
  state.noticeTimer = window.setTimeout(() => { state.notice = null; render(); }, 3200);
  render();
}

async function checkSession() {
  try {
    const payload = await request('/api/session');
    state.authenticated = Boolean(payload.authenticated);
    if (state.authenticated) await loadData(false);
  } catch (error) {
    state.authenticated = false;
    state.notice = { message: error.message, error: true };
  }
  render();
}

async function loadData(showNotice = false) {
  state.sync = 'syncing';
  render();
  try {
    const [reagents, activities] = await Promise.all([
      request('/api/reagents'),
      request('/api/activity?limit=20'),
    ]);
    state.reagents = reagents.reagents ?? [];
    state.activities = activities.activities ?? [];
    state.sync = 'online';
    if (showNotice) notify('数据已刷新'); else render();
  } catch (error) {
    state.sync = 'offline';
    notify(error.message, true);
  }
}

function renderAuth() {
  return `<main class="auth-page">
    <section class="auth-card" aria-labelledby="auth-title">
      <div class="auth-mark">${icon('flask')}</div>
      <p class="auth-kicker">TIANLAB · LAB MANAGEMENT</p>
      <h1 id="auth-title">实验室管理</h1>
      <p class="auth-copy">输入课题组密码后，管理共享试剂信息。</p>
      <form class="auth-form" data-login-form>
        <label class="field-label" for="management-password">课题组密码</label>
        <div class="password-wrap">
          <input id="management-password" name="password" type="${state.passwordVisible ? 'text' : 'password'}" autocomplete="current-password" placeholder="请输入密码" required />
          <button class="password-toggle" type="button" data-action="toggle-password" aria-label="${state.passwordVisible ? '隐藏密码' : '显示密码'}">${icon(state.passwordVisible ? 'eyeOff' : 'eye')}</button>
        </div>
        ${state.notice?.error ? `<p class="form-error" role="alert">${escapeHtml(state.notice.message)}</p>` : ''}
        <button class="auth-submit" type="submit">进入管理模块</button>
      </form>
      <p class="auth-footnote">电脑与手机共享同一份实时数据</p>
    </section>
  </main>`;
}

function renderHeader() {
  const online = state.sync !== 'offline';
  return `<header class="app-header"><div class="header-inner">
    <a class="brand" href="../" aria-label="返回实验室网站">
      <span class="brand-mark">${icon('flask')}</span>
      <span class="brand-copy"><strong>实验室管理</strong><small>TIANLAB · SHARED WORKSPACE</small></span>
    </a>
    <div class="header-actions">
      <span class="sync-state ${online ? '' : 'offline'}"><i class="sync-dot"></i>${online ? '实时同步' : '连接异常'}</span>
      <button class="header-button" type="button" data-action="refresh" aria-label="刷新数据">${icon('refresh')}</button>
      <button class="header-button logout" type="button" data-action="logout">退出</button>
    </div>
  </div></header>`;
}

function renderStats() {
  const low = state.reagents.filter((item) => reagentStatus(item) === '库存偏低').length;
  const expiring = state.reagents.filter((item) => reagentStatus(item) === '即将到期').length;
  return `<section class="stats-grid" aria-label="库存概况">
    <article class="stat-card"><span>当前试剂</span><strong>${formatNumber(state.reagents.length)} <small>项</small></strong></article>
    <article class="stat-card warning"><span>库存偏低</span><strong>${formatNumber(low)} <small>项</small></strong></article>
    <article class="stat-card danger"><span>30天内到期</span><strong>${formatNumber(expiring)} <small>项</small></strong></article>
  </section>`;
}

function renderReagentCard(reagent) {
  const status = reagentStatus(reagent);
  const statusClass = status === '库存偏低' ? 'low' : status === '即将到期' ? 'expiring' : '';
  return `<article class="reagent-card ${statusClass}">
    <div class="card-top"><span class="tag">${escapeHtml(reagent.category)}</span><span class="status ${statusClass}">${escapeHtml(status)}</span></div>
    <h3>${escapeHtml(reagent.name)}</h3>
    <p class="cas">CAS：${escapeHtml(reagent.cas || '未填写')}</p>
    <div class="quantity-row"><span><small>当前库存</small><strong>${formatNumber(reagent.quantity)}</strong> ${escapeHtml(reagent.unit)}</span><span><small>最低提醒</small><strong>${formatNumber(reagent.minQuantity)}</strong> ${escapeHtml(reagent.unit)}</span></div>
    <div class="card-meta"><span>${icon('pin')}${escapeHtml(reagent.location)}</span><span>${escapeHtml(reagent.storageTemp)}</span></div>
    <div class="card-footer"><span class="supplier">${escapeHtml(reagent.supplier || '未填写供应商')} · ${escapeHtml(formatDate(reagent.expiry))}</span><span class="card-actions"><button class="small-button" type="button" data-action="edit" data-id="${reagent.id}">修改</button><button class="small-button delete" type="button" data-action="delete" data-id="${reagent.id}">删除</button></span></div>
  </article>`;
}

function renderActivity() {
  if (!state.activities.length) return '';
  return `<section class="activity-panel"><div class="panel-heading"><div><h2>最近操作</h2><p>所有成员的修改会同步记录在这里。</p></div></div><ul class="activity-list">${state.activities.slice(0, 8).map((item) => `<li><span><b>${escapeHtml(item.action)}</b>　${escapeHtml(item.summary)}</span><time>${escapeHtml(new Date(item.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</time></li>`).join('')}</ul></section>`;
}

function renderFormField(label, name, value, options = {}) {
  const { type = 'text', required = false, full = false, placeholder = '' } = options;
  return `<div class="form-field ${full ? 'full' : ''}"><label for="reagent-${name}">${label}${required ? ' <span class="required">*</span>' : ''}</label><input id="reagent-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} /></div>`;
}

function renderModal() {
  if (!state.modal) return '';
  const reagent = state.modal.reagent ?? {};
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-content>
    <div class="modal-header"><div><h2 id="modal-title">${state.modal.mode === 'edit' ? '修改试剂' : '新增试剂'}</h2><p>保存后电脑和手机会自动同步最新数据。</p></div><button class="close-button" type="button" data-action="close-modal" aria-label="关闭">×</button></div>
    <form data-reagent-form><div class="form-grid">
      ${renderFormField('试剂名称', 'name', reagent.name ?? '', { required: true, placeholder: '例如：乙腈' })}
      <div class="form-field"><label for="reagent-category">分类</label><select id="reagent-category" name="category">${categories.slice(1).map((item) => `<option value="${escapeHtml(item)}" ${item === (reagent.category || '其他') ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></div>
      ${renderFormField('CAS号', 'cas', reagent.cas ?? '', { placeholder: '可选' })}
      ${renderFormField('存放位置', 'location', reagent.location ?? '', { required: true, placeholder: '例如：冰箱A-2层-03号' })}
      <div class="form-field"><label for="reagent-storageTemp">保存条件</label><select id="reagent-storageTemp" name="storageTemp">${temperatures.map((item) => `<option value="${escapeHtml(item)}" ${item === (reagent.storageTemp || '待确认') ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></div>
      ${renderFormField('当前库存', 'quantity', reagent.quantity ?? 0, { type: 'number', placeholder: '0' })}
      ${renderFormField('单位', 'unit', reagent.unit ?? '瓶', { placeholder: '瓶、管、克…' })}
      ${renderFormField('最低提醒量', 'minQuantity', reagent.minQuantity ?? 0, { type: 'number', placeholder: '0 表示不提醒' })}
      ${renderFormField('供应商', 'supplier', reagent.supplier ?? '', { placeholder: '可选' })}
      ${renderFormField('有效期', 'expiry', reagent.expiry ?? '', { type: 'date' })}
      ${renderFormField('备注', 'note', reagent.note ?? '', { full: true, placeholder: '可选' })}
    </div><div class="modal-actions"><button class="secondary-button" type="button" data-action="close-modal">取消</button><button class="primary-button" type="submit">保存记录</button></div></form>
  </section></div>`;
}

function renderApp() {
  const items = visibleReagents();
  return `<div class="app-shell">${renderHeader()}<main class="main-inner">
    <section class="intro-row"><div><p class="eyebrow">TIANLAB · SHARED INVENTORY</p><h1>实验室管理</h1><p>快速查看试剂位置、库存与有效期，所有成员看到同一份最新数据。</p></div><div class="intro-actions"><button class="secondary-button" type="button" data-action="refresh">${icon('refresh')} 刷新</button><button class="primary-button" type="button" data-action="add">＋ 新增试剂</button></div></section>
    ${renderStats()}
    <section><div class="panel-heading"><div><h2>全部试剂</h2><p>按名称、CAS号、位置或供应商搜索</p></div><span class="result-count">${items.length} 项</span></div><div class="toolbar"><label class="search-box">${icon('search')}<input type="search" data-search placeholder="搜索试剂名称、CAS号、位置…" value="${escapeHtml(state.query)}" aria-label="搜索试剂" /></label><select data-category aria-label="按分类筛选">${categories.map((item) => `<option value="${escapeHtml(item)}" ${item === state.category ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></div><div class="reagent-grid">${items.length ? items.map(renderReagentCard).join('') : '<div class="empty-state"><strong>还没有试剂记录</strong><span>点击“新增试剂”，从第一条记录开始建立共享库存。</span></div>'}</div></section>
    ${renderActivity()}
  </main>${renderModal()}${state.notice ? `<div class="notice ${state.notice.error ? 'error' : ''}" role="status">${escapeHtml(state.notice.message)}</div>` : ''}</div>`;
}

function render() {
  root.innerHTML = state.authenticated ? renderApp() : renderAuth();
}

async function submitLogin(form) {
  const password = new FormData(form).get('password');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const session = await request('/api/session', { method: 'POST', body: JSON.stringify({ password }) });
    storeSession(session.token);
    state.authenticated = true;
    state.notice = null;
    await loadData(false);
  } catch (error) {
    state.notice = { message: error.message, error: true };
  } finally {
    render();
  }
}

async function saveReagent(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  for (const key of ['quantity', 'minQuantity']) data[key] = Number(data[key] || 0);
  const isEdit = state.modal?.mode === 'edit';
  try {
    await request(isEdit ? `/api/reagents/${state.modal.reagent.id}` : '/api/reagents', { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(data) });
    state.modal = null;
    await loadData(false);
    notify(isEdit ? '试剂信息已更新' : '试剂已新增');
  } catch (error) {
    notify(error.message, true);
  }
}

async function deleteReagent(id) {
  const reagent = state.reagents.find((item) => String(item.id) === String(id));
  if (!reagent || !window.confirm(`确定删除“${reagent.name}”吗？删除后其他成员也将无法看到这条记录。`)) return;
  try {
    await request(`/api/reagents/${id}`, { method: 'DELETE' });
    await loadData(false);
    notify('试剂记录已删除');
  } catch (error) {
    notify(error.message, true);
  }
}

root.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.matches('[data-login-form]')) submitLogin(event.target);
  if (event.target.matches('[data-reagent-form]')) saveReagent(event.target);
});

root.addEventListener('input', (event) => {
  if (event.target.matches('[data-search]')) {
    state.query = event.target.value;
    const cursor = event.target.selectionStart;
    render();
    const nextSearch = root.querySelector('[data-search]');
    nextSearch?.focus();
    if (cursor !== null) nextSearch?.setSelectionRange(cursor, cursor);
  }
});

root.addEventListener('change', (event) => {
  if (event.target.matches('[data-category]')) { state.category = event.target.value; render(); }
});

root.addEventListener('click', async (event) => {
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  if (action === 'toggle-password') { state.passwordVisible = !state.passwordVisible; render(); return; }
  if (action === 'close-modal' && (!event.target.closest('[data-modal-content]') || actionTarget.classList.contains('close-button') || actionTarget.classList.contains('secondary-button'))) { state.modal = null; render(); return; }
  if (action === 'add') { state.modal = { mode: 'add', reagent: null }; render(); return; }
  if (action === 'edit') { state.modal = { mode: 'edit', reagent: state.reagents.find((item) => String(item.id) === String(actionTarget.dataset.id)) }; render(); return; }
  if (action === 'delete') { await deleteReagent(actionTarget.dataset.id); return; }
  if (action === 'refresh') { await loadData(true); return; }
  if (action === 'logout') {
    await request('/api/session', { method: 'DELETE' }).catch(() => undefined);
    storeSession('');
    state.authenticated = false;
    state.reagents = [];
    state.activities = [];
    render();
  }
});

window.setInterval(() => { if (state.authenticated && !state.modal) loadData(false); }, 20000);
checkSession();
