/* Presentation-only bilingual UI. Never change form values, URLs, storage records, or API payloads. */
(() => {
  'use strict';
  if (window.TianlabLanguage) return;
  const messages = window.TianlabLocaleMessages || {};
  const storageKey = 'tianlab_interface_language';
  const scriptUrl = document.currentScript?.src || new URL('assets/language.js', document.baseURI).href;
  const attributes = ['placeholder', 'aria-label', 'title', 'alt'];
  const originals = new WeakMap();
  const originalAttributes = new WeakMap();
  const excluded = 'script,style,noscript,textarea,code,pre,[translate="no"],.notranslate,[contenteditable="true"],[data-language-switch]';
  let language = 'zh';
  try { language = localStorage.getItem(storageKey) === 'en' ? 'en' : 'zh'; } catch { /* Session-only fallback. */ }

  const normalize = text => text.trim().replace(/\s+/g, ' ');
  function translate(text) {
    if (typeof text !== 'string') return text;
    const source = normalize(text);
    let result = messages[source];
    if (result === undefined) {
      const numberRules = [
        [/^© (\d{4}) 本草光语·大健康研究实验室$/, (_, year) => `© ${year} Herblumen · Health Research Laboratory`],
        [/^全选(.+)的可批准项$/, (_, name) => `Select eligible requests for ${name}`],
        [/^选择(.+)$/, (_, name) => `Select ${name}`],
        [/^(.+)的待审批申请$/, (_, name) => `Pending requests for ${name}`],
        [/^(.+)申请的(.+)$/, (_, name, reagent) => `${name} — ${reagent}`],
        [/^确定把“(.+)”移入回收站吗？之后仍可以恢复。$/, (_, name) => `Move “${name}” to the recycle bin? It can be restored later.`],
        [/^确定永久删除“(.+)”吗？此操作无法恢复。$/, (_, name) => `Permanently delete “${name}”? This cannot be undone.`],
        [/^确认“(.+)”已到货但尚未入库？标记后开始计算7天收货期限。$/, (_, name) => `Confirm that “${name}” has arrived but is not yet stocked? This starts the 7-day receipt deadline.`],
        [/^(实验室简介|研究方向|研究成果|团队成员|新闻动态|加入与联系|实验室管理|科研论文)(\s*[|｜]\s*)本草光语·大健康研究实验室$/, (_, page) => `${messages[page]} | Herblumen · Health Research Laboratory`],
        [/^本草光语·大健康研究实验室｜中国药科大学中药资源系$/, () => 'Herblumen · Health Research Laboratory | China Pharmaceutical University'],
        [/^提交\s*(\d+)\s*条申请审批$/, (_, n) => `Submit ${n} Request${n === '1' ? '' : 's'}`],
        [/^确认批准\s*(\d+)\s*条申请？$/, (_, n) => `Approve ${n} Request${n === '1' ? '' : 's'}?`],
        [/^确认批准\s*(\d+)\s*条$/, (_, n) => `Approve ${n} Request${n === '1' ? '' : 's'}`],
        [/^(批准所选|批准该组)\s*(\d+)\s*条$/, (_, mode, n) => `${mode === '批准所选' ? 'Approve Selected' : 'Approve Group'} (${n})`],
        [/^(\d+)\s*位申请人 ·\s*(\d+)\s*条待审批$/, (_, people, n) => `${people} applicants · ${n} pending requests`],
        [/^(\d+)\s*条待审批$/, (_, n) => `${n} pending requests`],
        [/^(\d+)\s*(项|条|单|次)$/, (_, n, unit) => `${n} ${{项:'items',条:'records',单:'orders',次:'times'}[unit]}`],
        [/^第\s*(\d+)\s*条试剂$/, (_, n) => `Reagent ${n}`],
        [/^删除第\s*(\d+)\s*条试剂$/, (_, n) => `Remove reagent ${n}`],
        [/^共\s*(\d+)\s*条试剂 · 申请总额 ¥([\d,.]+)$/, (_, n, amount) => `${n} reagents · Requested total ¥${amount}`],
        [/^(\d+)\s*项结果 · 按位置与保存条件查看$/, (_, n) => `${n} results · View locations and storage conditions`],
        [/^(待审批|待收货|已收货入库|已驳回)订单$/, (_, stage) => `${messages[stage]} Orders`],
        [/^当前：(待审批|待收货|待收货（已到货）|已收货入库|已驳回) · (.+)$/, (_, stage, next) => `${messages[stage]} · ${messages[next] || next}`],
        [/^删除前：(待审批|待收货|待收货（已到货）|已收货入库|已驳回) · 需要时可恢复订单$/, (_, stage) => `Previous status: ${messages[stage]} · Restore when needed`],
        [/^请求失败（(\d+)）$/, (_, code) => `Request failed (${code})`],
        [/^已批准 (\d+) 条，均已进入“待收货”；当前仍显示待审批申请，方便继续处理。$/, (_, n) => `${n} requests approved and moved to Awaiting Receipt. Remaining requests are shown for further review.`],
        [/^已确认批准 (\d+) 条。审批已暂停，其余申请请以刷新后的状态为准。$/, (_, n) => `${n} approvals confirmed. Approval has paused; check refreshed statuses for the remaining requests.`],
        [/^(\d{4})级｜(.+)$/, (_, year, subject) => `Class of ${year} | ${messages[subject] || subject}`],
        [/^年级：(一年级|二年级|三年级)$/, (_, year) => `Year ${['一年级','二年级','三年级'].indexOf(year) + 1}`],
        [/^专业方向：(.+)$/, (_, field) => `Field: ${messages[field] || field}`]
      ];
      for (const [pattern, replacement] of numberRules) {
        if (pattern.test(source)) { result = source.replace(pattern, replacement); break; }
      }
    }
    if (result === undefined) return text;
    const leading = text.match(/^\s*/)[0];
    const trailing = text.match(/\s*$/)[0];
    return leading + result + trailing;
  }

  function skip(element) { return !element || Boolean(element.closest(excluded)); }
  function updateText(node) {
    if (skip(node.parentElement)) return;
    const old = originals.get(node);
    const source = old && node.data === old.rendered ? old.source : node.data;
    const rendered = language === 'en' ? translate(source) : source;
    if (rendered !== node.data) node.data = rendered;
    originals.set(node, { source, rendered });
  }
  function updateAttributes(element) {
    if (skip(element)) return;
    const saved = originalAttributes.get(element) || {};
    for (const name of attributes) {
      const current = element.getAttribute(name);
      if (current === null) { delete saved[name]; continue; }
      const old = saved[name];
      const source = old && current === old.rendered ? old.source : current;
      const rendered = language === 'en' ? translate(source) : source;
      if (current !== rendered) element.setAttribute(name, rendered);
      saved[name] = { source, rendered };
    }
    originalAttributes.set(element, saved);
  }
  function updateTree(root) {
    if (root.nodeType === Node.TEXT_NODE) { updateText(root); return; }
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (skip(root)) return;
      updateAttributes(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.nodeType === Node.ELEMENT_NODE && skip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === Node.TEXT_NODE) updateText(walker.currentNode);
      else updateAttributes(walker.currentNode);
    }
  }

  function mountSwitch() {
    const header = document.querySelector('.header-inner, .lab-site-header-inner');
    const parent = header || document.body;
    let control = document.querySelector('[data-language-switch]');
    if (!control) {
      control = document.createElement('div');
      control.dataset.languageSwitch = '';
      control.className = 'language-switcher';
      control.setAttribute('role', 'group');
      control.setAttribute('translate', 'no');
      for (const [value, label] of [['zh', '中文'], ['en', 'EN']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.lang = value === 'zh' ? 'zh-CN' : 'en';
        button.textContent = label;
        button.dataset.language = value;
        button.addEventListener('click', () => setLanguage(value));
        control.append(button);
      }
      parent.append(control);
    } else if (header && control.parentElement !== header) header.append(control);
    control.classList.toggle('language-switcher-floating', !header);
    control.setAttribute('aria-label', language === 'en' ? 'Interface language' : '界面语言');
    for (const button of control.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
      button.setAttribute('aria-label', button.dataset.language === 'en' ? 'Switch to English' : '切换为中文');
    }
  }

  const observer = new MutationObserver(records => {
    const roots = new Set();
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) roots.add(node);
      else roots.add(record.target);
    }
    observer.disconnect();
    mountSwitch();
    for (const root of roots) if (root.isConnected) updateTree(root);
    observe();
  });
  function observe() {
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  }
  function setLanguage(value, persist = true) {
    language = value === 'en' ? 'en' : 'zh';
    observer.disconnect();
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.documentElement.dataset.interfaceLanguage = language;
    mountSwitch();
    updateTree(document.head.querySelector('title') || document.head);
    updateTree(document.body);
    if (persist) try { localStorage.setItem(storageKey, language); } catch { /* Still works without persistence. */ }
    observe();
    window.dispatchEvent(new CustomEvent('tianlab-language-change', { detail: language }));
  }
  window.TianlabLanguage = Object.freeze({
    get current() { return language; },
    t(text) { return language === 'en' ? translate(text) : text; },
    setLanguage
  });
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('language.css?v=20261016-1', scriptUrl).href;
  document.head.append(style);
  window.addEventListener('storage', event => { if (event.key === storageKey) setLanguage(event.newValue, false); });
  setLanguage(language, false);
})();
