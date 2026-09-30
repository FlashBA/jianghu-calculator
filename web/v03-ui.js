(() => {
  const data = window.WIKI_REFERENCE_DATA || {};
  const directoryData = window.GUIDE_DIRECTORY_DATA || {};
  const appViewNames = ['calculator', 'teams', 'cards', 'encyclopedia'];
  const dataBase = window.APP_DATA_BASE || './';
  const guideState = { searchIndex: null, strategyGuides: null, recipeData: null, strategyText: null, current: null, searchQuery: '' };

  const ICONS = {
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 21 19H3L12 3Z"></path><path d="M12 9v4M12 16h.01"></path></svg>',
    food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10"></path><path d="M16 3v18M16 3c3 2 4 5 0 8"></path></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path><path d="M8 10.8h5.6"></path></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"></path><path d="M9 3v15M15 6v15"></path></svg>',
    formation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5" r="2"></circle><circle cx="6" cy="12" r="2"></circle><circle cx="18" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle><path d="m10.5 6.5-3 4M13.5 6.5l3 4M7.5 13.5l3 4M16.5 13.5l-3 4"></path></svg>',
    sword: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 4 6 6-9.5 9.5H6v-4.5L12 9"></path><path d="m4 20 5-5M13 5l6 6M8 8l8 8"></path></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="M12 10v6M12 7h.01"></path></svg>',
  };

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const iconSvg = (name, tone = 'red') => `<span class="v03-guide-icon v03-guide-icon-${tone}" aria-hidden="true">${ICONS[name] || ICONS.info}</span>`;
  const assetUrl = (path) => `${dataBase}${String(path || '').replace(/^\.\//, '')}`;
  const viewElements = () => [document.getElementById('home-view'), ...appViewNames.map((name) => document.getElementById(`${name}-view`)), document.getElementById('guide-view')].filter(Boolean);

  function correctStrategyText(strategyText) {
    const sections = strategyText?.sections || {};
    const replacements = [
      ['白免', '白兔'], ['迫命', '追命'], ['盡掌', '蛊掌'], ['盖掌', '蛊掌'],
      ['云屋', '云崖'], ['无板剑', '无极剑'], ['一指禪', '一指禅'], ['一指神', '一指禅'],
      ['无极牶', '无极拳'], ['纯阼', '纯阳'], ['渊a海', '渊海'], ['无,极剑', '无极剑'],
      ['隆龙', '降龙'], ['先夭', '先天'], ['倚夭', '倚天'], ['斩夭', '斩天'],
      ['夭狼', '天狼'], ['洽澜', '沧澜'], ['玄夭', '玄天'], ['夭机', '天机'],
      ['夭音', '天音'], ['凤呜', '凤鸣'], ['鸿呜', '鸿鸣'], ['伏縻', '伏魔'],
      ['隆爢', '降魔'], ['血瓜', '血爪'], ['矅日', '曜日'], ['曜目', '曜日'],
      ['万舨', '万躯'], ['盅掌', '蛊掌'], ['柳妇意', '柳如意'], ['太虛', '太虚'],
      ['桂流血', '挂流血'], ['能桂流血', '能挂流血'], ['咯有', '略有'], ['合金量', '含金量'],
    ];
    Object.values(sections).forEach((section) => {
      if (!section?.text) return;
      replacements.forEach(([from, to]) => { section.text = section.text.replaceAll(from, to); });
      section.text = section.text
        .replaceAll('林\n洁\n舞', '林清舞')
        .replaceAll('宗\n洋', '宗泽');
    });
    const martial = sections.miegu_martial_inner;
    if (martial) martial.text = martial.text.replace('噬\n6\n2.0%', '噬心\n6\n2.0%');
    const equipment = sections.miegu_equipment;
    if (equipment) {
      equipment.text = equipment.text
        .replace('虎魄\n202\n168.0%', '虎魄\n202\n68.0%')
        .replace('镇龙\n9.1%\n10\n3.4%', '镇龙\n27\n9.1%\n天机\n10\n3.4%')
        .replace('朱雀\n^6', '朱雀\n6');
    }
    const followers = sections.miegu_followers;
    if (followers) {
      followers.text = followers.text
        .replace('主\n331100. 0%', '主\n33\n100.0%')
        .replace('玄同\n31\n196.9%', '玄同\n31\n96.9%')
        .replace('顾言\n32\n197. 0%', '顾言\n32\n97.0%')
        .replace('达摩\n11\n145.8%', '达摩\n11\n45.8%')
        .replace('太和\n137.5%', '太和\n37.5%')
        .replace('太和11\n184.6%', '太和\n11\n84.6%');
    }
    const rating = sections.whiterabbit_martial_rating;
    if (rating) rating.text = rating.text.replace('119.转魄', '19.转魄');
    return strategyText;
  }

  function fetchJson(path) {
    return fetch(`${dataBase}${path}`, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  function strategyById(id) {
    return (guideState.strategyGuides?.guides || []).find((item) => item.id === id);
  }

  function strategyCount(id) {
    const guide = strategyById(id);
    if (!guide) return '加载中';
    return `${guide.sections.reduce((total, section) => total + (section.items?.length || 1), 0)} 项内容`;
  }

  function getGuideCatalog() {
    const records = guideState.searchIndex?.records || [];
    const docxCount = records.filter((item) => item.source === 'original_guide').length;
    const recipes = guideState.recipeData?.recipes || directoryData.recipes || [];
    return [
      { id: 'pitfalls', title: '避坑指南', icon: 'alert', tone: 'red', source: 'Excel 汇总', summary: '开局选择、任务道具、令牌和版本机制的易错点。', meta: `${directoryData.pitfalls?.length || 11} 条注意事项` },
      { id: 'recipes', title: '菜谱大全', icon: 'food', tone: 'gold', source: '腾讯文档 · 菜谱配方', summary: '按线上原件整理的菜名与材料配方。', meta: `${recipes.length} 道菜谱记录` },
      { id: 'original-search', title: '原版攻略检索', icon: 'search', tone: 'red', source: 'DOCX 检索索引', summary: '只检索原版攻略 DOCX 的任务、NPC、地点和关键词。', meta: `${docxCount || 221} 条原攻略分块` },
      { id: 'longgu-outer-points', title: '龙谷外围点位', icon: 'map', tone: 'gold', source: '专题攻略', summary: '灭谷相关 Boss 的外围坐标与标记信息。', meta: strategyCount('longgu-outer-points') },
      { id: 'miegu-lineup-summary', title: '灭谷阵容汇总', icon: 'formation', tone: 'red', source: '专题攻略', summary: '武学、内功、装备、随从与 33 套阵容文字整理。', meta: strategyCount('miegu-lineup-summary') },
      { id: 'white-rabbit-martial-rating', title: '白兔武功评级', icon: 'sword', tone: 'gold', source: '专题攻略', summary: '白兔 2.83 孤本武学强度梯度与个人向文字评级。', meta: strategyCount('white-rabbit-martial-rating') },
      { id: 'version-notes', title: '版本规则', icon: 'info', tone: 'gray', source: '白兔版数据', summary: '速度条、状态阈值、技艺和任督等基础规则。', meta: `${data.guide_notes?.length || 0} 条版本提示` },
    ];
  }

  function renderGuideDirectory() {
    const list = document.getElementById('guide-directory');
    if (!list) return;
    list.innerHTML = getGuideCatalog().map((item) => `
      <button class="v03-guide-directory-card" type="button" data-guide-id="${escapeHtml(item.id)}">
        ${iconSvg(item.icon, item.tone)}
        <span class="v03-guide-directory-copy"><small>${escapeHtml(item.source)}</small><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.summary)}</em><b>${escapeHtml(item.meta)}</b></span>
        <span class="v03-guide-directory-arrow" aria-hidden="true">›</span>
      </button>
    `).join('');
  }

  function showGuideDirectory({ updateHash = false } = {}) {
    const directory = document.getElementById('guide-directory');
    const detail = document.getElementById('guide-detail');
    if (directory) directory.hidden = false;
    if (detail) detail.hidden = true;
    guideState.current = null;
    if (updateHash && location.hash !== '#guide') history.pushState({}, '', '#guide');
  }

  function setGuideDetailHeading(item) {
    const title = document.getElementById('guide-detail-title');
    if (!title) return;
    title.innerHTML = `<div class="v03-guide-detail-title-row">${iconSvg(item.icon, item.tone)}<div><p class="section-kicker">${escapeHtml(item.source)}</p><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p></div></div>`;
  }

  function renderPitfalls() {
    return `<div class="v03-guide-note-list">${(directoryData.pitfalls || []).map((item) => {
      const title = item.title.replace(/^第一项：|^第二项：|^第三项：|^第四项：|^第五项：|^第六项：|^第七项：|^第八项：|^第九项：|^第十项：|^第十一项：/, '');
      return `<article class="v03-guide-note-card"><span class="v03-guide-note-index">${escapeHtml(item.title.split('：')[0])}</span><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(item.text)}</p></div></article>`;
    }).join('')}</div>`;
  }

  function renderRecipes() {
    const recipes = guideState.recipeData?.recipes || directoryData.recipes || [];
    const source = guideState.recipeData?.source;
    return `<div class="v03-recipe-list">${recipes.map((item) => {
      const ingredients = item.ingredients?.map((ingredient) => `${ingredient.name} ×${ingredient.quantity}`).join('、') || item.detail || '配方待补';
      return `<article class="v03-recipe-card"><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(ingredients)}</p></div><span class="v03-guide-status is-ready">已同步</span></article>`;
    }).join('')}<p class="v03-guide-source-note">来源：${escapeHtml(source?.sheet_name || '腾讯文档')} · ${escapeHtml(source?.synced_at ? source.synced_at.slice(0, 10) : '已同步')}</p></div>`;
  }

  function renderOriginalSearch() {
    return `<div class="v03-original-search-panel"><label class="v03-guide-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="guide-search-input" type="search" value="${escapeHtml(guideState.searchQuery)}" placeholder="搜索原版攻略任务、NPC 或地点" autocomplete="off"></label><div class="v03-guide-search-meta"><span id="guide-search-count"></span><span>仅来自原版攻略 DOCX</span></div><div id="guide-search-results" class="v03-guide-search-results"></div></div>`;
  }

  function normalizeGuideSearch(value) {
    return String(value || '').toLocaleLowerCase().replace(/[\s，。！？；：、,.!?;:\[\]（）()【】『』<>《》\-—_]+/g, '');
  }

  function guideSearchTerms(value) {
    const normalized = normalizeGuideSearch(value);
    if (!normalized) return [];
    const terms = [normalized];
    const split = String(value || '').toLocaleLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-z0-9]+/g) || [];
    split.forEach((term) => {
      const normalizedTerm = normalizeGuideSearch(term);
      if (normalizedTerm && !terms.includes(normalizedTerm)) terms.push(normalizedTerm);
    });
    return terms;
  }

  function rankOriginalRecord(item, query) {
    const title = normalizeGuideSearch(item.title);
    const section = normalizeGuideSearch(item.section);
    const topic = normalizeGuideSearch(item.topic);
    const keywords = (item.keywords || []).map(normalizeGuideSearch).join('|');
    const text = normalizeGuideSearch(item.text);
    const terms = guideSearchTerms(query);
    let score = 0;
    let matchedTerms = 0;
    terms.forEach((term, index) => {
      let termScore = 0;
      if (title.includes(term)) termScore = Math.max(termScore, index === 0 ? 120 : 72);
      if (topic.includes(term)) termScore = Math.max(termScore, 100);
      if (keywords.includes(term)) termScore = Math.max(termScore, 84);
      if (section.includes(term)) termScore = Math.max(termScore, 58);
      if (text.includes(term)) termScore = Math.max(termScore, 24);
      if (termScore) matchedTerms += 1;
      score += termScore;
    });
    if (terms.length > 1 && matchedTerms === terms.length) score += 36;
    if (item.task_like) score += 3;
    return score;
  }

  function originalRecords(query = '') {
    const records = (guideState.searchIndex?.records || []).filter((item) => item.source === 'original_guide');
    const normalized = normalizeGuideSearch(query);
    if (!normalized) return { records, filtered: records.filter((item) => item.task_like).slice(0, 12) };
    const filtered = records
      .map((item) => ({ item, score: rankOriginalRecord(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || (left.item.paragraph_start ?? 999999) - (right.item.paragraph_start ?? 999999))
      .map(({ item }) => item);
    return { records, filtered };
  }

  function renderOriginalResults() {
    const result = document.getElementById('guide-search-results');
    const count = document.getElementById('guide-search-count');
    if (!result || !count) return;
    const { records, filtered } = originalRecords(guideState.searchQuery);
    if (!records.length) {
      count.textContent = '索引加载中';
      result.innerHTML = '<p class="v03-guide-empty">正在读取离线索引…</p>';
      return;
    }
    count.textContent = guideState.searchQuery ? `匹配 ${filtered.length} 条，展示前 40 条` : `共 ${records.length} 条，先显示 12 条任务相关记录`;
    const visible = filtered.slice(0, 40);
    result.innerHTML = visible.length ? visible.map((item) => `<article class="v03-guide-search-result"><div class="v03-guide-result-top"><strong>${escapeHtml(item.title || '未命名条目')}</strong><span>${escapeHtml(item.section || item.category || '攻略')}</span></div><p>${escapeHtml(item.text || '')}</p><small>${escapeHtml(item.source_label || item.source || '')}${item.source_version ? ` · ${escapeHtml(item.source_version)}` : ''}</small></article>`).join('') : '<p class="v03-guide-empty">没有匹配内容，换一个任务名、NPC 或地点试试。</p>';
  }

  function strategyCell(item) {
    const points = item.points?.map((point) => `${point.value?.x ?? '-'}、${point.value?.y ?? '-'}`).join(' / ');
    return [item.boss, item.npc, points, item.flags?.join('、') || ''].map((value) => `<td>${escapeHtml(value || '')}</td>`).join('');
  }

  function renderStrategy(guide) {
    if (!guide) return '<p class="v03-guide-empty">专题攻略数据加载中…</p>';
    return `<div class="v03-strategy-detail"><p class="v03-guide-source-note">来源：${escapeHtml(guide.source?.file || guide.title || '')}</p>${guide.sections.map((section) => {
      if (section.type === 'image') {
        const textSection = guideState.strategyText?.sections?.[section.id];
        const title = textSection?.title || section.title;
        const image = section.asset
          ? `<figure class="v03-strategy-image"><img src="${escapeHtml(assetUrl(section.asset))}" alt="${escapeHtml(title)}" loading="lazy"><figcaption><strong>${escapeHtml(section.source_name || title)}</strong><span>${escapeHtml(section.detail || '')}</span></figcaption></figure>`
          : '';
        const text = textSection?.text
          ? `<div class="v03-strategy-text">${escapeHtml(textSection.text)}</div>`
          : '';
        if (!image && !text) return '';
        return `<section class="v03-strategy-text-section"><h3>${escapeHtml(title)}</h3>${image}${text}</section>`;
      }
      if (guide.id === 'longgu-outer-points' && section.id === 'boss-points') return `<section class="v03-strategy-section"><h3>${escapeHtml(section.title)}</h3><div class="v03-longgu-points-grid">${(section.items || []).map((item) => `<article class="v03-longgu-point-card"><header><div><strong>${escapeHtml(item.boss || '未命名 Boss')}</strong><span>${escapeHtml(item.npc || '人物待补')}</span></div><b>${item.points?.length || 0} 个点位</b></header><div class="v03-longgu-point-list">${(item.points || []).map((point, index) => `<span class="v03-longgu-point-chip"><i>${index + 1}</i>${escapeHtml(`${point.value?.x ?? '-'}、${point.value?.y ?? '-'}`)}</span>`).join('')}</div>${item.flags?.length ? `<div class="v03-longgu-point-flags">${item.flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join('')}</div>` : ''}</article>`).join('')}</div></section>`;
      if (section.type === 'table') return `<section class="v03-strategy-section"><h3>${escapeHtml(section.title)}</h3><div class="v03-guide-table-wrap"><table class="v03-guide-table"><thead><tr>${section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${(section.items || []).map((item) => `<tr>${strategyCell(item)}</tr>`).join('')}</tbody></table></div></section>`;
      return '';
    }).join('')}</div>`;
  }

  function renderVersionNotes() {
    return `<div class="v03-guide-note-list">${(data.guide_notes || []).map((item) => `<article class="v03-guide-note-card"><span class="v03-guide-note-index">P${escapeHtml(item.page || '-')}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div></article>`).join('')}</div>`;
  }

  function renderGuideDetailContent(id) {
    const content = document.getElementById('guide-detail-content');
    if (!content) return;
    if (id === 'pitfalls') content.innerHTML = renderPitfalls();
    else if (id === 'recipes') content.innerHTML = renderRecipes();
    else if (id === 'original-search') content.innerHTML = renderOriginalSearch();
    else if (id === 'version-notes') content.innerHTML = renderVersionNotes();
    else content.innerHTML = renderStrategy(strategyById(id));
    if (id === 'original-search') renderOriginalResults();
  }

  function bindDetailEvents() {
    document.getElementById('guide-search-input')?.addEventListener('input', (event) => {
      guideState.searchQuery = event.target.value;
      renderOriginalResults();
    });
  }

  function openGuide(id, { updateHash = true } = {}) {
    const item = getGuideCatalog().find((entry) => entry.id === id);
    if (!item) return showGuideDirectory();
    const directory = document.getElementById('guide-directory');
    const detail = document.getElementById('guide-detail');
    if (directory) directory.hidden = true;
    if (detail) detail.hidden = false;
    guideState.current = id;
    if (id !== 'original-search') guideState.searchQuery = '';
    setGuideDetailHeading(item);
    renderGuideDetailContent(id);
    bindDetailEvents();
    if (updateHash && location.hash !== `#guide/${id}`) history.pushState({}, '', `#guide/${id}`);
  }

  function updateActive(target) {
    document.querySelectorAll('[data-v03-target]').forEach((button) => button.classList.toggle('is-active', button.dataset.v03Target === target));
  }

  function hideAllViews() {
    viewElements().forEach((element) => { element.hidden = true; });
  }

  function show(target, { guideId = null, encyclopediaType = null, updateHash = false } = {}) {
    const normalized = target === 'guide' ? 'guide' : appViewNames.includes(target) ? target : 'home';
    hideAllViews();
    updateActive(normalized);
    const view = document.getElementById(`${normalized}-view`);
    if (view) view.hidden = false;
    if (normalized === 'guide') {
      renderGuideDirectory();
      if (guideId) openGuide(guideId, { updateHash: false });
      else showGuideDirectory({ updateHash });
      return;
    }
    if (normalized === 'encyclopedia' && encyclopediaType) {
      const selector = document.getElementById('encyclopedia-type');
      if (selector && selector.value !== encyclopediaType) selector.value = encyclopediaType;
    }
    if (normalized !== 'home') document.querySelector(`#app-nav [data-view="${normalized}"]`)?.click();
    if (normalized === 'encyclopedia' && encyclopediaType) {
      document.getElementById('encyclopedia-type')?.dispatchEvent(new Event('change', { bubbles: true }));
      if (updateHash && location.hash !== `#encyclopedia/${encyclopediaType}`) history.pushState({}, '', `#encyclopedia/${encyclopediaType}`);
    }
  }

  function openSearch(value) {
    const query = String(value || '').trim();
    if (!query) return;
    show('encyclopedia');
    const input = document.getElementById('encyclopedia-search');
    if (!input) return;
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function routeFromHash() {
    const hash = location.hash.replace(/^#/, '');
    if (hash.startsWith('guide/')) return { target: 'guide', guideId: decodeURIComponent(hash.slice(6)) };
    if (hash === 'guide') return { target: 'guide', guideId: null };
    if (hash.startsWith('encyclopedia/')) return { target: 'encyclopedia', encyclopediaType: decodeURIComponent(hash.slice(13)) };
    return { target: ['calculator', 'teams', 'cards', 'encyclopedia'].includes(hash) ? hash : 'home', guideId: null, encyclopediaType: null };
  }

  function bind() {
    document.querySelectorAll('[data-v03-target]').forEach((button) => button.addEventListener('click', () => {
      const target = button.dataset.v03Target;
      if (target === 'guide') show('guide', { guideId: button.dataset.guideId || null, updateHash: true });
      else if (target === 'encyclopedia') show('encyclopedia', { encyclopediaType: button.dataset.encyclopediaType || null, updateHash: Boolean(button.dataset.encyclopediaType) });
      else show(target);
    }));
    document.getElementById('guide-directory')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-id]');
      if (button) openGuide(button.dataset.guideId);
    });
    document.getElementById('guide-back')?.addEventListener('click', () => show('guide', { updateHash: true }));

    const homeSearch = document.getElementById('home-search');
    homeSearch?.addEventListener('keydown', (event) => { if (event.key === 'Enter') openSearch(homeSearch.value); });
    document.querySelectorAll('[data-home-search]').forEach((button) => button.addEventListener('click', () => {
      homeSearch.value = button.dataset.homeSearch;
      openSearch(button.dataset.homeSearch);
    }));

    const count = document.getElementById('home-encyclopedia-count');
    if (count) count.textContent = `${data.characters?.length || 0} 位角色 · ${data.martial_arts?.length || 0} 门武学`;
  }

  function loadGuideSources() {
    Promise.all([fetchJson('guide_search_index.json'), fetchJson('strategy_guides.json'), fetchJson('tencent_recipe_data.json'), fetchJson('strategy_ocr_data.json')]).then(([searchIndex, strategyGuides, recipeData, strategyText]) => {
      guideState.searchIndex = { ...searchIndex, records: (searchIndex.records || []).filter((item) => item.source === 'original_guide') };
      guideState.strategyGuides = strategyGuides;
      guideState.recipeData = recipeData;
      guideState.strategyText = correctStrategyText(strategyText);
      renderGuideDirectory();
      if (guideState.current) {
        const current = guideState.current;
        const query = guideState.searchQuery;
        openGuide(current, { updateHash: false });
        guideState.searchQuery = query;
        if (current === 'original-search') {
          const input = document.getElementById('guide-search-input');
          if (input) input.value = query;
          renderOriginalResults();
        }
      }
    }).catch((error) => console.warn('攻略索引加载失败', error));
  }

  renderGuideDirectory();
  bind();
  loadGuideSources();
  const initialRoute = routeFromHash();
  show(initialRoute.target, { guideId: initialRoute.guideId, encyclopediaType: initialRoute.encyclopediaType });
  window.addEventListener('jianghu-app-ready', () => {
    const route = routeFromHash();
    show(route.target, { guideId: route.guideId, encyclopediaType: route.encyclopediaType });
  });
  window.addEventListener('hashchange', () => {
    const route = routeFromHash();
    show(route.target, { guideId: route.guideId, encyclopediaType: route.encyclopediaType });
  });
  window.addEventListener('popstate', () => {
    const route = routeFromHash();
    show(route.target, { guideId: route.guideId, encyclopediaType: route.encyclopediaType });
  });
})();
