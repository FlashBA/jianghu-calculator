(() => {
  let data = {};
  let directoryData = {};
  const appViewNames = ['calculator', 'teams', 'cards', 'encyclopedia', 'favorites', 'achievements'];
  const guideState = { searchIndex: null, strategyGuides: null, recipeData: null, strategyText: null, updateLogs: null, current: null, searchQuery: '', updateLogQuery: '', updateLogVersion: '' };
  const GUIDE_FAVORITES_KEY = 'jianghu-stat-simulator:guide:favorites:v1';
  const ACHIEVEMENT_PROGRESS_KEY = 'jianghu-stat-simulator:achievements:v1';
  let ACHIEVEMENT_RECORDS = [];
  let achievementCategories = [];
  let achievementsLoaded = false;
  let achievementCategory = '';
  let achievementLimit = 40;
  let achievementSaveFailed = false;
  let guideFavorites = readGuideFavorites();
  let achievementProgress = readAchievementProgress();
  let pendingFavoriteChunkId = '';
  let detailEventsBound = false;

  let STRATEGY_TABLES = {};

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
  const iconSvg = (name, tone = 'red') => `<span class="v03-guide-icon v03-guide-icon-${['red', 'gold', 'gray'].includes(tone) ? tone : 'red'}" aria-hidden="true">${ICONS[name] || ICONS.info}</span>`;
  const viewElements = () => [document.getElementById('home-view'), ...appViewNames.map((name) => document.getElementById(`${name}-view`)), document.getElementById('guide-view')].filter(Boolean);

  function readGuideFavorites() {
    try {
      const value = JSON.parse(localStorage.getItem(GUIDE_FAVORITES_KEY) || '[]');
      return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function saveGuideFavorites() {
    localStorage.setItem(GUIDE_FAVORITES_KEY, JSON.stringify([...guideFavorites]));
  }

  function readAchievementProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(ACHIEVEMENT_PROGRESS_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function saveAchievementProgress() {
    try {
      localStorage.setItem(ACHIEVEMENT_PROGRESS_KEY, JSON.stringify(achievementProgress));
      achievementSaveFailed = false;
    } catch {
      achievementSaveFailed = true;
    }
  }

  function toggleAchievement(id) {
    const key = String(id || '');
    if (!ACHIEVEMENT_RECORDS.some((item) => item.id === key && item.available)) return;
    achievementProgress[key] = !achievementProgress[key];
    saveAchievementProgress();
    renderAchievements();
  }

  function renderAchievements() {
    const list = document.getElementById('achievements-list');
    const count = document.getElementById('achievements-count');
    if (!list || !count) return;
    const eligible = ACHIEVEMENT_RECORDS.filter((item) => item.available);
    const completed = eligible.filter((item) => achievementProgress[item.id] === true).length;
    count.textContent = `${completed} / ${eligible.length} 已收集`;
    document.getElementById('home-achievements-count').textContent = `${completed} / ${eligible.length} 已收集`;
    const progress = document.getElementById('achievements-progress');
    progress.max = eligible.length || 1;
    progress.value = completed;
    document.getElementById('achievements-progress-text').textContent = `${eligible.length ? Math.round(completed / eligible.length * 1000) / 10 : 0}%`;
    const categories = [{ id: '', title: '全部分类' }, ...achievementCategories];
    document.getElementById('achievements-categories').innerHTML = categories.map((category) => {
      const items = eligible.filter((item) => !category.id || item.category === category.id);
      const done = items.filter((item) => achievementProgress[item.id] === true).length;
      return `<option value="${escapeHtml(category.id)}"${category.id === achievementCategory ? ' selected' : ''}>${escapeHtml(category.title)} · ${done}/${items.length}</option>`;
    }).join('');
    const query = document.getElementById('achievements-search').value.trim().toLocaleLowerCase();
    const status = document.getElementById('achievements-status').value;
    const priority = (item) => !item.available ? 0 : achievementProgress[item.id] === true ? 2 : 1;
    const filtered = ACHIEVEMENT_RECORDS.filter((item) => (!achievementCategory || item.category === achievementCategory)
      && (!query || `${item.title} ${item.access} ${item.rank || ''}`.toLocaleLowerCase().includes(query))
      && (status === 'all' || (status === 'unavailable' ? !item.available : item.available
        && (status === 'complete' ? achievementProgress[item.id] === true : achievementProgress[item.id] !== true))))
      .sort((left, right) => priority(left) - priority(right));
    document.getElementById('achievements-feedback').textContent = achievementSaveFailed
      ? '本次勾选未能保存到设备，请稍后重试。'
      : `${filtered.length} 项${status === 'all' && filtered.some((item) => !item.available) ? ' · 暂未开放不计入进度' : ''}`;
    const more = document.getElementById('achievements-more');
    more.hidden = filtered.length <= achievementLimit;
    more.textContent = `加载更多（剩余 ${Math.max(0, filtered.length - achievementLimit)} 项）`;
    if (!ACHIEVEMENT_RECORDS.length) {
      list.innerHTML = `<p class="v03-achievements-empty">${achievementsLoaded ? '暂无成就清单' : guideState.loadError ? '成就数据加载失败' : '正在读取成就清单…'}</p>`;
      return;
    }
    const focused = document.activeElement?.dataset.achievementId;
    const categoryTitle = (id) => achievementCategories.find((item) => item.id === id)?.title || '';
    list.innerHTML = filtered.slice(0, achievementLimit).map((item) => {
      const subtitle = [categoryTitle(item.category), item.access,
        !item.available && !item.access.includes('暂未开放') && '暂未开放'].filter(Boolean).join(' · ');
      return `
      <div class="v03-achievement-item${achievementProgress[item.id] === true ? ' is-complete' : ''}${item.available ? '' : ' is-unavailable'}">
        <input type="checkbox" data-achievement-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)}${item.rank ? ` ${escapeHtml(item.rank)}级` : ''} 已收集"${achievementProgress[item.id] === true ? ' checked' : ''}${item.available ? '' : ' disabled'}>
        <div class="v03-achievement-copy">
          <span class="v03-achievement-heading"><strong>${escapeHtml(item.title)}</strong><span class="v03-achievement-rank">${escapeHtml(item.rank || `上限 ${item.maxLevel} 级`)}</span></span>
          <small>${escapeHtml(subtitle)}</small>
        </div>
      </div>
    `;
    }).join('');
    if (!filtered.length) list.innerHTML = '<p class="v03-achievements-empty">没有匹配的条目</p>';
    if (focused) [...list.querySelectorAll('[data-achievement-id]')].find((input) => input.dataset.achievementId === focused)?.focus({ preventScroll: true });
  }

  function toggleGuideFavorite(id) {
    const key = String(id || '');
    if (!key) return;
    if (guideFavorites.has(key)) guideFavorites.delete(key);
    else guideFavorites.add(key);
    saveGuideFavorites();
    renderFavorites();
  }

  function guideFavoriteButton(id, label) {
    const active = guideFavorites.has(id);
    return `<button type="button" class="v03-favorite-button${active ? ' is-favorite' : ''}" data-guide-favorite="${escapeHtml(id)}" aria-label="${active ? '取消收藏' : '收藏'}${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}"><span aria-hidden="true">${active ? '♥' : '♡'}</span></button>`;
  }

  function encyclopediaFavoriteButton(id, label) {
    // This button is rendered only for entries already in the favorites list.
    const active = true;
    return `<button type="button" class="v03-favorite-button${active ? ' is-favorite' : ''}" data-encyclopedia-favorite="${escapeHtml(id)}" aria-label="${active ? '取消收藏' : '收藏'}${escapeHtml(label)}" aria-pressed="${active ? 'true' : 'false'}"><span aria-hidden="true">${active ? '♥' : '♡'}</span></button>`;
  }

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

  function strategyById(id) {
    return (guideState.strategyGuides?.guides || []).find((item) => item.id === id);
  }

  function strategyCount(id) {
    const guide = strategyById(id);
    if (!guide) return guideState.loadError ? '加载失败' : '加载中';
    return `${guide.sections.reduce((total, section) => total + (section.items?.length || 1), 0)} 项内容`;
  }

  function getGuideCatalog() {
    const records = guideState.searchIndex?.records || [];
    const docxCount = records.filter((item) => item.source === 'original_guide').length;
    const recipes = guideState.recipeData?.recipes || directoryData.recipes || [];
    const priority = ['pitfalls', 'original-search', 'recipes', 'miegu-lineup-summary', 'white-rabbit-martial-rating', 'update-logs', 'wudao-insight-exchange'];
    const rank = (item) => priority.includes(item.id) ? priority.indexOf(item.id) : priority.length;
    return [
      { id: 'pitfalls', title: '避坑指南', author: '@邩木', icon: 'alert', tone: 'red', source: '腾讯文档 · 游玩注意事项', summary: '开局选择、任务道具、令牌和版本机制的易错点。', meta: `${directoryData.pitfalls?.length || 0} 条注意事项` },
      { id: 'recipes', title: '菜谱大全', author: '@邩木', icon: 'food', tone: 'gold', source: '腾讯文档 · 菜谱配方', summary: '按线上原件整理的菜名与材料配方。', meta: `${recipes.length} 道菜谱记录` },
      { id: 'original-search', title: '原版攻略检索', icon: 'search', tone: 'red', source: 'DOCX 检索索引', summary: '原版攻略任务、NPC、地点和关键词。', meta: `${docxCount || 221} 条原攻略分块` },
      ...(guideState.strategyGuides?.guides || []).map((guide) => ({
        id: guide.id, title: guide.title, author: guide.author || '',
        icon: guide.icon || 'info', tone: guide.tone || 'red',
        source: '专题攻略', summary: guide.summary || '', meta: strategyCount(guide.id),
      })),
      { id: 'update-logs', title: '更新日志', icon: 'info', tone: 'gray', source: '白兔更新日志', summary: '按版本倒序查看游戏更新内容。', meta: `${guideState.updateLogs?.logs?.length || 0} 个版本` },
    ].sort((left, right) => rank(left) - rank(right));
  }

  function renderGuideDirectory() {
    const list = document.getElementById('guide-directory');
    if (!list) return;
    list.innerHTML = getGuideCatalog().map((item) => `
      <button class="v03-guide-directory-card" type="button" data-guide-id="${escapeHtml(item.id)}">
        ${iconSvg(item.icon, item.tone)}
        <span class="v03-guide-directory-copy"><span class="v03-guide-directory-heading"><strong>${escapeHtml(item.title)}</strong>${item.author ? `<small>作者：${escapeHtml(item.author)}</small>` : ''}</span><em>${escapeHtml(item.summary)}</em></span>
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
    const freshnessNote = item.id === 'pitfalls'
      ? `<p class="v03-guide-freshness-note">${escapeHtml(directoryData.pitfallsNotice || '')}</p>`
      : '';
    const isLibrary = item.id === 'original-search';
    title.innerHTML = `<div class="v03-guide-detail-title-row${isLibrary ? '' : ' has-favorite'}">${iconSvg(item.icon, item.tone)}<div>${item.author ? `<p class="section-kicker">作者：${escapeHtml(item.author)}</p>` : ''}<h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p>${freshnessNote}</div>${isLibrary ? '' : guideFavoriteButton(`guide:${item.id}`, item.title)}</div>`;
  }

  function renderPitfalls() {
    return `<div class="v03-guide-note-list">${(directoryData.pitfalls || []).map((item, index) => {
      const title = item.title;
      const warning = item.warning ? `<strong class="v03-guide-warning">${escapeHtml(item.warning)}</strong>` : '';
      return `<article class="v03-guide-note-card${item.warning ? ' is-warning' : ''}"><span class="v03-guide-note-index">${index + 1}</span><div><h3>${escapeHtml(title)}</h3>${warning}<p>${escapeHtml(item.text)}</p></div></article>`;
    }).join('')}</div>`;
  }

  function renderRecipes() {
    const recipes = guideState.recipeData?.recipes || directoryData.recipes || [];
    return `<div class="v03-recipe-list">${recipes.map((item) => {
      const ingredients = item.ingredients?.map((ingredient) => `${ingredient.name} ×${ingredient.quantity}`).join('、') || item.detail || '配方待补';
      return `<article class="v03-recipe-card"><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(ingredients)}</p></div><span class="v03-guide-status is-ready">已同步</span></article>`;
    }).join('')}</div>`;
  }

  function renderOriginalSearch() {
    return `<div class="v03-original-search-panel"><label class="v03-guide-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="guide-search-input" type="search" value="${escapeHtml(guideState.searchQuery)}" placeholder="搜索原版攻略任务、NPC 或地点" autocomplete="off"></label><div class="v03-guide-search-meta"><span id="guide-search-count"></span></div><div id="guide-search-results" class="v03-guide-search-results"></div></div>`;
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

  function normalizeOriginalSearch(value) {
    return normalizeGuideSearch(String(value || '').replaceAll('吸心', '吸星'));
  }

  function originalSearchTerms(value) {
    return guideSearchTerms(String(value || '').replaceAll('吸心', '吸星'));
  }

  function originalDisplayText(value) {
    return String(value || '').replaceAll('吸心大法', '吸星大法');
  }

  const DEFAULT_ORIGINAL_GUIDE_GROUPS = [
    { label: '吸星大法', titleTerms: ['临安篇1 · 支线任务1', '临安篇1 · 拼酒顺序', '临安篇1 · 水牢走法'], terms: ['吸星大法', '吸心大法'] },
    { label: '灵石岛任务', terms: ['灵石岛'] },
    { label: '泰山送信任务', terms: ['送信给金刀门王元霸', '泰山商店开启 · 任务一'] },
  ];

  function originalRecordContains(item, terms) {
    const searchable = normalizeOriginalSearch([
      item.title,
      item.section,
      item.topic,
      item.text,
      ...(item.keywords || []),
    ].join(' '));
    return terms.some((term) => searchable.includes(normalizeOriginalSearch(term)));
  }

  function defaultOriginalRecords(records) {
    const selected = [];
    const seen = new Set();
    DEFAULT_ORIGINAL_GUIDE_GROUPS.forEach((group) => {
      records.filter((item) => {
        if (item.category !== 'task') return false;
        if (group.titleTerms?.length) {
          const title = normalizeOriginalSearch(item.title);
          return group.titleTerms.some((term) => title.includes(normalizeOriginalSearch(term)));
        }
        return originalRecordContains(item, group.terms);
      }).forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        selected.push(item);
      });
    });
    return selected;
  }

  function rankOriginalRecord(item, query) {
    const title = normalizeOriginalSearch(item.title);
    const section = normalizeOriginalSearch(item.section);
    const topic = normalizeOriginalSearch(item.topic);
    const keywords = (item.keywords || []).map(normalizeOriginalSearch);
    const text = normalizeOriginalSearch(item.text);
    const terms = originalSearchTerms(query);
    let score = 0;
    let matchedTerms = 0;
    terms.forEach((term, index) => {
      let termScore = 0;
      if (title.includes(term)) termScore = Math.max(termScore, index === 0 ? 120 : 72);
      if (topic.includes(term)) termScore = Math.max(termScore, 100);
      if (keywords.some((keyword) => keyword === term)) termScore = Math.max(termScore, 84);
      else if (keywords.some((keyword) => keyword.includes(term))) termScore = Math.max(termScore, 48);
      if (section.includes(term)) termScore = Math.max(termScore, 58);
      if (text.includes(term)) termScore = Math.max(termScore, 24);
      if (termScore) matchedTerms += 1;
      score += termScore;
    });
    if (terms.length > 1 && matchedTerms === terms.length) score += 36;
    return score;
  }

  function originalRecordHasStructuredMatch(item, query) {
    const fields = [item.title, item.section, item.topic].map(normalizeOriginalSearch);
    return originalSearchTerms(query).some((term) => fields.some((field) => field.includes(normalizeGuideSearch(term))));
  }

  function originalRecords(query = '') {
    const records = (guideState.searchIndex?.records || []).filter((item) => item.source === 'original_guide');
    const normalized = normalizeGuideSearch(query);
    if (!normalized) return { records, filtered: defaultOriginalRecords(records) };
    const scored = records
      .map((item) => ({ item, score: rankOriginalRecord(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || (left.item.paragraph_start ?? 999999) - (right.item.paragraph_start ?? 999999));
    const hasStructuredMatch = scored.some(({ item }) => originalRecordHasStructuredMatch(item, query));
    const filtered = (hasStructuredMatch
      ? scored.filter(({ item }) => originalRecordHasStructuredMatch(item, query) || item.category === 'task')
      : scored
    ).map(({ item }) => item);
    return { records, filtered };
  }

  function renderOriginalResults() {
    const result = document.getElementById('guide-search-results');
    const count = document.getElementById('guide-search-count');
    if (!result || !count) return;
    const { records, filtered } = originalRecords(guideState.searchQuery);
    if (!records.length) {
      count.textContent = guideState.loadError ? '加载失败，请重新打开或刷新重试' : '索引加载中';
      result.innerHTML = '<p class="v03-guide-empty">正在读取离线索引…</p>';
      return;
    }
    count.textContent = guideState.searchQuery ? `匹配 ${filtered.length} 条，展示前 20 条` : `推荐 ${filtered.length} 条支线记录 · 输入关键词检索全部 ${records.length} 条`;
    const visible = filtered.slice(0, 20);
    result.innerHTML = visible.length ? visible.map((item) => `<article class="v03-guide-search-result" data-guide-record-id="${escapeHtml(item.id)}"><div class="v03-guide-result-top"><strong>${escapeHtml(originalDisplayText(item.title || '未命名条目'))}</strong><span>${escapeHtml(originalDisplayText(item.section || item.category || '攻略'))}</span>${guideFavoriteButton(`chunk:${item.id}`, originalDisplayText(item.title || '攻略条目'))}</div><p>${escapeHtml(originalDisplayText(item.text || ''))}</p></article>`).join('') : '<p class="v03-guide-empty">没有匹配内容，换一个任务名、NPC 或地点试试。</p>';
    if (pendingFavoriteChunkId) {
      const target = [...result.querySelectorAll('[data-guide-record-id]')].find((element) => element.dataset.guideRecordId === pendingFavoriteChunkId);
      if (target) {
        target.classList.add('is-target');
        target.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
      pendingFavoriteChunkId = '';
    }
  }

  function renderFavorites() {
    const list = document.getElementById('favorites-list');
    const count = document.getElementById('favorites-count');
    if (!list || !count) return;
    const catalog = getGuideCatalog();
    const chunks = guideState.searchIndex?.records || [];
    const catalogById = new Map(catalog.map((item) => [`guide:${item.id}`, item]));
    const chunksById = new Map(chunks.map((item) => [`chunk:${item.id}`, item]));
    const guideItems = [...guideFavorites].map((key) => {
      if (key.startsWith('guide:')) {
        const item = catalogById.get(key);
        return item ? { key, type: 'guide', title: item.title, meta: item.author ? `作者：${item.author}` : '攻略', guideId: item.id } : null;
      }
      if (key.startsWith('chunk:')) {
        const item = chunksById.get(key);
        return item ? { key, type: 'chunk', title: item.title || '未命名条目', meta: item.section || '原版攻略', record: item } : null;
      }
      return null;
    }).filter(Boolean);
    const encyclopediaItems = (window.jianghuEncyclopedia?.getFavoriteEntries?.() || []).map(({ key, type, id, record }) => ({
      key,
      type: 'encyclopedia',
      encyclopediaType: type,
      recordId: id,
      title: record.name || '未命名条目',
      meta: record.meta || record.style || type,
    }));
    const favorites = [...guideItems, ...encyclopediaItems];
    count.textContent = `${favorites.length} 条`;
    if (!favorites.length) {
      list.innerHTML = '<p class="v03-home-favorites-empty">暂未收藏内容</p>';
      return;
    }
    list.innerHTML = favorites.map((item) => `
      <article class="v03-home-favorite-item">
        <button type="button" class="v03-home-favorite-open" data-home-favorite-type="${item.type}" data-home-favorite-guide="${escapeHtml(item.guideId || '')}" data-home-favorite-chunk="${escapeHtml(item.record?.id || '')}" data-home-favorite-encyclopedia-type="${escapeHtml(item.encyclopediaType || '')}" data-home-favorite-record="${escapeHtml(item.recordId || '')}">
          <strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}</small>
        </button>
        ${item.type === 'encyclopedia' ? encyclopediaFavoriteButton(item.key, item.title) : guideFavoriteButton(item.key, item.title)}
      </article>
    `).join('');
  }

  function strategyCell(item) {
    const points = item.points?.map((point) => `${point.value?.x ?? '-'}、${point.value?.y ?? '-'}`).join(' / ');
    return [item.boss, item.npc, points, item.flags?.join('、') || ''].map((value) => `<td>${escapeHtml(value || '')}</td>`).join('');
  }

  let FOLLOWER_DETAILS = [];

  const LINEUP_COLUMNS = ['随从', '武学', '内功', '武器', '护甲', '戒指', '护腕'];
  let LINEUP_DIRECTORY = [];

  function renderStrategyTable(table) {
    const scrollClass = table.rows.length > 12 ? ' is-scrollable' : '';
    return `<div class="v03-guide-table-wrap v03-strategy-data-table is-columns-${table.columns.length}${scrollClass}"><table class="v03-guide-table"><thead><tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderStrategyGroup(title, columns, rows) {
    return `<details class="v03-strategy-table-group"><summary>${escapeHtml(title)}<span>${rows.length} 项</span></summary>${renderStrategyTable({ columns, rows })}</details>`;
  }

  function renderPairedStrategyTable(table, splitAt, titles) {
    const leftRows = table.rows.map((row) => row.slice(0, splitAt)).filter((row) => row[0]);
    const rightRows = table.rows.map((row) => row.slice(splitAt)).filter((row) => row[0]);
    const leftColumns = table.columns.slice(0, splitAt);
    const rightColumns = table.columns.slice(splitAt);
    return `${renderStrategyGroup(titles[0], leftColumns, leftRows)}${renderStrategyGroup(titles[1], rightColumns, rightRows)}`;
  }

  function renderFollowerDetails() {
    return `<div class="v03-follower-detail-list">${FOLLOWER_DETAILS.map(([name, martial, inner]) => `
      <details class="v03-follower-detail">
        <summary><strong>${escapeHtml(name)}</strong><span>武学 ${martial.length} 项 · 内功 ${inner.length} 项</span></summary>
        <div class="v03-follower-detail-content">
          <div><h5>武学</h5>${renderStrategyTable({ columns: ['名称', '出场次', '使用率'], rows: martial })}</div>
          <div><h5>内功</h5>${renderStrategyTable({ columns: ['名称', '出场次', '使用率'], rows: inner })}</div>
        </div>
      </details>
    `).join('')}</div>`;
  }

  function renderLineupRows(rows) {
    return `<div class="v03-lineup-rows">${rows.map((row) => `
      <article class="v03-lineup-row">
        <strong>${escapeHtml(row[0] || '未标注')}</strong>
        <div class="v03-lineup-fields">
          ${LINEUP_COLUMNS.slice(1).map((label, index) => `<span><small>${escapeHtml(label)}</small><b>${escapeHtml(row[index + 1] || '/')}</b></span>`).join('')}
        </div>
      </article>
    `).join('')}</div>`;
  }

  function renderLineupSection() {
    const parsedCount = LINEUP_DIRECTORY.filter((item) => item.rows?.length).length;
    return `<section class="v03-strategy-text-section v03-lineup-section">
      <div class="v03-lineup-section-heading">
        <div>
          <h3>阵容配置</h3>
        </div>
        <span class="v03-lineup-progress">${parsedCount}/${LINEUP_DIRECTORY.length}</span>
      </div>
      <div class="v03-lineup-directory-list">
        ${LINEUP_DIRECTORY.map((item, index) => `
          <details class="v03-lineup-directory">
            <summary><strong>${index + 1}. ${escapeHtml(item.title)}</strong><span>${escapeHtml(item.author || '原图未标注')}</span></summary>
            ${item.rows?.length ? renderLineupRows(item.rows) : '<p class="v03-lineup-pending">该组已确认名称，成员配置待补全。</p>'}
          </details>
        `).join('')}
      </div>
    </section>`;
  }

  function renderRatingText(text) {
    const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const tierRows = lines.filter((line) => /^T(?:10086|[0-5])：/.test(line)).map((line) => {
      const separator = line.indexOf('：');
      return [line.slice(0, separator), line.slice(separator + 1)];
    });
    const analysisRows = [];
    let currentRow = null;
    lines.forEach((line) => {
      const match = line.match(/^(\d+)[.．、]\s*(.*)$/);
      if (match) {
        if (currentRow) analysisRows.push(currentRow);
        currentRow = [match[1], match[2]];
      } else if (currentRow) {
        currentRow[1] = `${currentRow[1]} ${line}`.replace(/\s+/g, ' ').trim();
      }
    });
    if (currentRow) analysisRows.push(currentRow);
    return `${tierRows.length ? renderStrategyGroup('强度梯度', ['梯度', '武学'], tierRows) : ''}${analysisRows.length ? renderStrategyGroup('个人向说明', ['序号', '说明'], analysisRows) : `<div class="v03-strategy-text">${escapeHtml(text || '文字资料待补')}</div>`}`;
  }

  function renderStrategyTextSection(section, textSection) {
    const title = section.id === 'whiterabbit_martial_rating'
      ? '白兔 2.83 武功评级'
      : textSection?.title || section.title;
    const text = textSection?.text || '';
    if (section.id === 'whiterabbit_martial_rating') {
      return `<section class="v03-strategy-text-section"><h3>${escapeHtml(title)}</h3>${renderRatingText(text)}</section>`;
    }
    const table = STRATEGY_TABLES[section.id];
    let tableMarkup = '';
    let extraMarkup = '';
    if (section.id === 'miegu_lineups') return renderLineupSection();
    if (section.id === 'miegu_martial_inner' && table) {
      tableMarkup = renderPairedStrategyTable(table, 3, ['武学出场率', '内功出场率']);
      extraMarkup = `<p class="v03-guide-source-note">${escapeHtml(table.note || '')}</p>`;
    } else if (section.id === 'miegu_equipment' && table) {
      const groups = [['武器', 0], ['护甲', 3], ['戒指', 6], ['护腕', 9]];
      tableMarkup = groups.map(([groupTitle, offset]) => renderStrategyGroup(groupTitle, table.columns.slice(offset, offset + 3), table.rows.map((row) => row.slice(offset, offset + 3)).filter((row) => row[0]))).join('');
      extraMarkup = `<p class="v03-guide-source-note">${escapeHtml(table.note || '')}</p>`;
    } else if (section.id === 'miegu_followers' && table) {
      tableMarkup = renderStrategyGroup('随从出场率', table.columns, table.rows);
      extraMarkup = `${renderFollowerDetails()}<p class="v03-guide-source-note">${escapeHtml(table.note || '')}</p>`;
    } else if (table) {
      tableMarkup = renderStrategyTable(table);
      extraMarkup = table.note ? `<p class="v03-guide-source-note">${escapeHtml(table.note)}</p>` : '';
    } else {
      tableMarkup = `<div class="v03-strategy-text">${escapeHtml(text || '文字资料待补')}</div>`;
    }
    return `<section class="v03-strategy-text-section"><h3>${escapeHtml(title)}</h3>${tableMarkup}${extraMarkup}</section>`;
  }

  function renderStrategy(guide) {
    if (!guide) return `<p class="v03-guide-empty">${guideState.loadError ? '攻略数据加载失败，请重新打开或刷新重试' : '专题攻略数据加载中…'}</p>`;
    const visibleSections = guide.sections;
    return `<div class="v03-strategy-detail">${visibleSections.map((section) => {
      if (section.type === 'image') {
        const textSection = guideState.strategyText?.sections?.[section.id];
        return renderStrategyTextSection(section, textSection);
      }
      if (section.type === 'text') return renderStrategyTextSection(section, section);
      if (section.type === 'table' && Array.isArray(section.rows)) return `<section class="v03-strategy-section"><h3>${escapeHtml(section.title)}</h3>${renderStrategyTable(section)}</section>`;
      if (guide.id === 'longgu-outer-points' && section.id === 'boss-points') return `<section class="v03-strategy-section"><h3>${escapeHtml(section.title)}</h3><div class="v03-longgu-points-grid">${(section.items || []).map((item) => `<article class="v03-longgu-point-card"><header><div><strong>${escapeHtml(item.boss || '未命名 Boss')}</strong><span>${escapeHtml(item.npc || '人物待补')}</span></div><b>${item.points?.length || 0} 个点位</b></header><div class="v03-longgu-point-list">${(item.points || []).map((point, index) => `<span class="v03-longgu-point-chip"><i>${index + 1}</i>${escapeHtml(`${point.value?.x ?? '-'}、${point.value?.y ?? '-'}`)}</span>`).join('')}</div>${item.flags?.length ? `<div class="v03-longgu-point-flags">${item.flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join('')}</div>` : ''}</article>`).join('')}</div></section>`;
      if (section.type === 'table') return `<section class="v03-strategy-section"><h3>${escapeHtml(section.title)}</h3><div class="v03-guide-table-wrap"><table class="v03-guide-table"><thead><tr>${section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${(section.items || []).map((item) => `<tr>${strategyCell(item)}</tr>`).join('')}</tbody></table></div></section>`;
      return '';
    }).join('')}</div>`;
  }

  function updateLogEntries() {
    const logs = guideState.updateLogs?.logs;
    if (!Array.isArray(logs)) return [];
    return [...logs].sort((left, right) => {
      const version = (item) => String(item.version || '').split('.').map((part) => Number(part) || 0);
      const a = version(left); const b = version(right);
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const delta = (b[index] || 0) - (a[index] || 0);
        if (delta) return delta;
      }
      return String(right.id || '').localeCompare(String(left.id || ''));
    });
  }

  function renderUpdateLogs() {
    const logs = updateLogEntries();
    const isLoading = !guideState.updateLogs;
    const query = normalizeGuideSearch(guideState.updateLogQuery);
    const visible = logs.filter((item) => {
      if (guideState.updateLogVersion && item.version !== guideState.updateLogVersion) return false;
      if (!query) return true;
      return normalizeGuideSearch(`${item.version} ${item.title} ${item.meta} ${item.body}`).includes(query);
    });
    const options = logs.map((item) => `<option value="${escapeHtml(item.version)}"${item.version === guideState.updateLogVersion ? ' selected' : ''}>${escapeHtml(item.version)}</option>`).join('');
    const listMarkup = isLoading
      ? `<p class="v03-guide-empty">${guideState.loadError ? '更新日志加载失败，请重新打开或刷新重试' : '更新日志加载中…'}</p>`
      : visible.length
        ? visible.map((item) => `<article class="v03-update-log-card" id="update-log-${escapeHtml(item.id || item.version)}"><header><div><span>版本 ${escapeHtml(item.version || '-')}</span><h3>${escapeHtml(item.title || `版本 ${item.version || '-'}`)}</h3></div><small>${escapeHtml(item.meta || '')}</small></header><div class="v03-update-log-body">${escapeHtml(item.body || '').split(/\n\n+/).map((paragraph) => `<p>${paragraph.replaceAll('\n', '<br>')}</p>`).join('')}</div></article>`).join('')
        : '<p class="v03-guide-empty">没有匹配的更新日志。</p>';
    return `<div class="v03-update-log-tools"><label class="v03-guide-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg><input id="update-log-search" type="search" value="${escapeHtml(guideState.updateLogQuery)}" placeholder="搜索更新日志" autocomplete="off"${isLoading ? ' disabled' : ''}></label><label class="v03-update-log-version"><span>版本</span><select id="update-log-version" aria-label="选择更新日志版本"${isLoading ? ' disabled' : ''}><option value="">全部版本</option>${options}</select></label></div><div class="v03-update-log-list">${listMarkup}</div>`;
  }

  function renderGuideDetailContent(id) {
    const content = document.getElementById('guide-detail-content');
    if (!content) return;
    if (id === 'pitfalls') content.innerHTML = renderPitfalls();
    else if (id === 'recipes') content.innerHTML = renderRecipes();
    else if (id === 'original-search') content.innerHTML = renderOriginalSearch();
    else if (id === 'update-logs') content.innerHTML = renderUpdateLogs();
    else content.innerHTML = renderStrategy(strategyById(id));
    if (id === 'original-search') renderOriginalResults();
  }

  function bindDetailEvents() {
    if (detailEventsBound) return;
    const detailTitle = document.getElementById('guide-detail-title');
    const detailContent = document.getElementById('guide-detail-content');
    detailContent?.addEventListener('input', (event) => {
      if (event.target.id === 'guide-search-input') {
        guideState.searchQuery = event.target.value;
        renderOriginalResults();
      } else if (event.target.id === 'update-log-search') {
        guideState.updateLogQuery = event.target.value;
        detailContent.innerHTML = renderUpdateLogs();
      }
    });
    detailContent?.addEventListener('change', (event) => {
      if (event.target.id !== 'update-log-version') return;
      guideState.updateLogVersion = event.target.value;
      detailContent.innerHTML = renderUpdateLogs();
    });
    detailTitle?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-favorite]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      toggleGuideFavorite(button.dataset.guideFavorite);
      setGuideDetailHeading(getGuideCatalog().find((item) => item.id === guideState.current));
    });
    detailContent?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-favorite]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      toggleGuideFavorite(button.dataset.guideFavorite);
      if (guideState.current === 'original-search') renderOriginalResults();
    });
    detailEventsBound = true;
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
    if (id !== 'update-logs') {
      guideState.updateLogQuery = '';
      guideState.updateLogVersion = '';
    }
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
    if (normalized === 'favorites') renderFavorites();
    if (normalized === 'achievements') renderAchievements();
    if (normalized === 'favorites' && updateHash && location.hash !== '#favorites') {
      history.pushState({}, '', '#favorites');
    }
    if (normalized === 'achievements' && updateHash && location.hash !== '#achievements') {
      history.pushState({}, '', '#achievements');
    }
    if (normalized === 'home' && updateHash && location.hash) {
      history.pushState({}, '', `${location.pathname}${location.search}`);
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

  async function copyGroupNumber(button) {
    const value = button?.dataset.copyGroup;
    if (!value) return;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const helper = document.createElement('textarea');
      helper.value = value;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      helper.remove();
    }
    const status = button.querySelector('small');
    if (!status) return;
    const original = status.textContent;
    status.textContent = copied ? '已复制' : '复制失败';
    button.classList.toggle('is-copied', copied);
    window.setTimeout(() => {
      status.textContent = original;
      button.classList.remove('is-copied');
    }, 1400);
  }

  function routeFromHash() {
    const hash = location.hash.replace(/^#/, '');
    if (hash.startsWith('guide/')) return { target: 'guide', guideId: decodeURIComponent(hash.slice(6)) };
    if (hash === 'guide') return { target: 'guide', guideId: null };
    if (hash.startsWith('encyclopedia/')) return { target: 'encyclopedia', encyclopediaType: decodeURIComponent(hash.slice(13)) };
    return { target: ['calculator', 'teams', 'cards', 'encyclopedia', 'favorites', 'achievements'].includes(hash) ? hash : 'home', guideId: null, encyclopediaType: null };
  }

  function bind() {
    document.querySelectorAll('[data-v03-target]').forEach((button) => button.addEventListener('click', () => {
      const target = button.dataset.v03Target;
      if (target === 'guide') show('guide', { guideId: button.dataset.guideId || null, updateHash: true });
      else if (target === 'encyclopedia') show('encyclopedia', { encyclopediaType: button.dataset.encyclopediaType || null, updateHash: Boolean(button.dataset.encyclopediaType) });
      else show(target, { updateHash: target === 'favorites' || target === 'achievements' || target === 'home' });
    }));
    document.getElementById('guide-directory')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-guide-id]');
      if (button) openGuide(button.dataset.guideId);
    });
    document.getElementById('guide-back')?.addEventListener('click', () => show('guide', { updateHash: true }));
    document.getElementById('favorites-list')?.addEventListener('click', (event) => {
      const encyclopediaFavorite = event.target.closest('[data-encyclopedia-favorite]');
      if (encyclopediaFavorite) {
        event.preventDefault();
        event.stopPropagation();
        window.jianghuEncyclopedia?.toggleFavorite?.(encyclopediaFavorite.dataset.encyclopediaFavorite);
        return;
      }
      const favoriteButton = event.target.closest('[data-guide-favorite]');
      if (favoriteButton) {
        event.preventDefault();
        event.stopPropagation();
        toggleGuideFavorite(favoriteButton.dataset.guideFavorite);
        return;
      }
      const button = event.target.closest('[data-home-favorite-type]');
      if (!button) return;
      if (button.dataset.homeFavoriteType === 'guide') {
        show('guide', { guideId: button.dataset.homeFavoriteGuide, updateHash: true });
        return;
      }
      if (button.dataset.homeFavoriteType === 'encyclopedia') {
        show('encyclopedia', { encyclopediaType: button.dataset.homeFavoriteEncyclopediaType, updateHash: true });
        window.setTimeout(() => window.jianghuEncyclopedia?.focusRecord?.(
          button.dataset.homeFavoriteEncyclopediaType,
          button.dataset.homeFavoriteRecord,
        ), 0);
        return;
      }
      pendingFavoriteChunkId = button.dataset.homeFavoriteChunk || '';
      guideState.searchQuery = button.querySelector('strong')?.textContent || '';
      show('guide', { guideId: 'original-search', updateHash: true });
    });
    document.getElementById('achievements-list')?.addEventListener('change', (event) => {
      const input = event.target.closest('[data-achievement-id]');
      if (input) toggleAchievement(input.dataset.achievementId);
    });
    document.getElementById('achievements-categories').addEventListener('change', (event) => {
      achievementCategory = event.target.value;
      achievementLimit = 40;
      renderAchievements();
    });
    document.getElementById('achievements-search').addEventListener('input', () => { achievementLimit = 40; renderAchievements(); });
    document.getElementById('achievements-status').addEventListener('change', () => { achievementLimit = 40; renderAchievements(); });
    document.getElementById('achievements-more').addEventListener('click', () => { achievementLimit += 40; renderAchievements(); });
    window.addEventListener('storage', (event) => {
      if (event.key === ACHIEVEMENT_PROGRESS_KEY || event.key === null) { achievementProgress = readAchievementProgress(); renderAchievements(); }
    });

    document.querySelectorAll('[data-copy-group]').forEach((button) => button.addEventListener('click', () => copyGroupNumber(button)));

    const count = document.getElementById('home-encyclopedia-count');
    if (count) count.textContent = `${data.characters?.length || 0} 位角色 · ${data.martial_arts?.length || 0} 门武学`;
  }

  function applyGuideContent(bundle) {
      guideState.loadError = false;
      achievementsLoaded = true;
      ACHIEVEMENT_RECORDS = bundle.data.achievements?.records || [];
      achievementCategories = bundle.data.achievements?.categories || [];
      if (!achievementCategories.some((item) => item.id === achievementCategory)) achievementCategory = '';
      renderAchievements();
      const { searchIndex, strategyGuides, recipeData, strategyText, updateLogs } = bundle.data;
      directoryData = bundle.data.directory;
      data = { ...bundle.data.encyclopedia, guide_notes: bundle.data.guideNotes };
      STRATEGY_TABLES = bundle.data.tables;
      FOLLOWER_DETAILS = bundle.data.followers;
      LINEUP_DIRECTORY = bundle.data.lineups;
      guideState.searchIndex = { ...searchIndex, records: (searchIndex.records || []).filter((item) => item.source === 'original_guide') };
      guideState.strategyGuides = strategyGuides;
      guideState.recipeData = recipeData;
      guideState.strategyText = correctStrategyText(JSON.parse(JSON.stringify(strategyText)));
      guideState.updateLogs = updateLogs;
      renderGuideDirectory();
      renderFavorites();
      const count = document.getElementById('home-encyclopedia-count');
      if (count) count.textContent = `${data.characters.length} 位角色 · ${data.martial_arts.length} 门武学`;
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
  }

  renderGuideDirectory();
  renderFavorites();
  renderAchievements();
  bind();
  window.JianghuContent.ready.then(applyGuideContent).catch((error) => {
    guideState.loadError = true;
    renderAchievements();
    console.warn('攻略索引加载失败', error);
    const count = document.getElementById('guide-search-count');
    if (count) count.textContent = '加载失败，请重新打开或刷新重试';
    const detail = document.getElementById('guide-detail-content');
    if (detail) detail.textContent = '攻略数据加载失败，请重新打开或刷新重试';
  });
  window.addEventListener('jianghu-content-updated', (event) => applyGuideContent(event.detail));
  window.addEventListener('jianghu-content-ready', (event) => applyGuideContent(event.detail));
  window.addEventListener('jianghu-encyclopedia-ready', () => renderFavorites());
  const initialRoute = routeFromHash();
  show(initialRoute.target, { guideId: initialRoute.guideId, encyclopediaType: initialRoute.encyclopediaType });
    window.addEventListener('jianghu-app-ready', () => {
    renderFavorites();
    const route = routeFromHash();
    show(route.target, { guideId: route.guideId, encyclopediaType: route.encyclopediaType });
  });
  window.addEventListener('jianghu-encyclopedia-favorites-changed', () => renderFavorites());
  window.addEventListener('hashchange', () => {
    const route = routeFromHash();
    show(route.target, { guideId: route.guideId, encyclopediaType: route.encyclopediaType });
  });
  window.addEventListener('popstate', () => {
    const route = routeFromHash();
    show(route.target, { guideId: route.guideId, encyclopediaType: route.encyclopediaType });
  });
})();
