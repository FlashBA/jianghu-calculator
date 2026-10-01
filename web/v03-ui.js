(() => {
  const data = window.WIKI_REFERENCE_DATA || {};
  const directoryData = window.GUIDE_DIRECTORY_DATA || {};
  const appViewNames = ['calculator', 'teams', 'cards', 'encyclopedia', 'favorites', 'achievements'];
  const dataBase = window.APP_DATA_BASE || './';
  const guideState = { searchIndex: null, strategyGuides: null, recipeData: null, strategyText: null, updateLogs: null, current: null, searchQuery: '', updateLogQuery: '', updateLogVersion: '' };
  const GUIDE_FAVORITES_KEY = 'jianghu-stat-simulator:guide:favorites:v1';
  const ACHIEVEMENT_PROGRESS_KEY = 'jianghu-stat-simulator:achievements:v1';
  const ACHIEVEMENT_RECORDS = [];
  let guideFavorites = readGuideFavorites();
  let achievementProgress = readAchievementProgress();
  let pendingFavoriteChunkId = '';
  let detailEventsBound = false;

  const STRATEGY_TABLES = {
    miegu_martial_inner: {
      columns: ['武学', '出场次', '出场率', '内功', '出场次', '出场率'],
      rows: [
        ['蛊掌', 28, '9.4%', '太和', 79, '26.6%'],
        ['达摩剑', 24, '8.1%', '达摩', 40, '13.5%'],
        ['关山', 23, '7.7%', '玄同', 31, '10.4%'],
        ['追风', 19, '6.4%', '离火', 29, '9.8%'],
        ['大同', 16, '5.4%', '/', 17, '5.7%'],
        ['千霜', 16, '5.4%', '斗转', 17, '5.7%'],
        ['转魄', 15, '5.1%', '镇狱', 17, '5.7%'],
        ['般若', 14, '4.7%', '易筋', 13, '4.4%'],
        ['中平', 13, '4.4%', '太玄', 11, '3.7%'],
        ['千山', 11, '3.7%', '纯阳', 8, '2.7%'],
        ['谪仙', 11, '3.7%', '金莲', 8, '2.7%'],
        ['达摩杖', 10, '3.4%', '噬心', 6, '2.0%'],
        ['打狗', 10, '3.4%', '寂影', 4, '1.3%'],
        ['降龙', 9, '3.0%', '白兔', 3, '1.0%'],
        ['佛刀', 8, '2.7%', '葵花', 3, '1.0%'],
        ['千钧', 7, '2.4%', '先天', 3, '1.0%'],
        ['追命', 7, '2.4%', '金顶', 2, '0.7%'],
        ['无极拳', 5, '1.7%', '渊海', 2, '0.7%'],
        ['曜日', 5, '1.7%', '乘风', 1, '0.3%'],
        ['倚天', 5, '1.7%', '乘云', 1, '0.3%'],
        ['斩天', 5, '1.7%', '九阳', 1, '0.3%'],
        ['三仙', 4, '1.3%', '蔷薇', 1, '0.3%'],
        ['万躯', 4, '1.3%', '', '', ''],
        ['云崖', 4, '1.3%', '', '', ''],
        ['沧澜', 3, '1.0%', '', '', ''],
        ['辟邪', 3, '1.0%', '', '', ''],
        ['天狼', 3, '1.0%', '', '', ''],
        ['无极剑', 3, '1.0%', '', '', ''],
        ['真武', 2, '0.7%', '', '', ''],
        ['碧波', 1, '0.3%', '', '', ''],
        ['定珠', 1, '0.3%', '', '', ''],
        ['独孤', 1, '0.3%', '', '', ''],
        ['光明', 1, '0.3%', '', '', ''],
        ['两仪', 1, '0.3%', '', '', ''],
        ['六脉', 1, '0.3%', '', '', ''],
        ['破锋', 1, '0.3%', '', '', ''],
        ['七星', 1, '0.3%', '', '', ''],
        ['青莲', 1, '0.3%', '', '', ''],
        ['玄天', 1, '0.3%', '', '', ''],
      ],
      note: '武学与内功包含非孤本，出场率按出场次数 / 总数 297 计算。',
    },
    miegu_equipment: {
      columns: ['武器', '次数', '出场率', '护甲', '次数', '出场率', '戒指', '次数', '出场率', '护腕', '次数', '出场率'],
      rows: [
        ['玄阴', 50, '16.8%', '虎魄', 202, '68.0%', '倾心', 57, '19.2%', '碧麟', 159, '53.5%'],
        ['血爪', 44, '14.8%', '真玄武', 33, '11.1%', '森罗', 37, '12.5%', '赤鬼', 46, '14.6%'],
        ['无锋', 31, '10.4%', '玄武甲', 17, '5.7%', '轩辕', 35, '11.8%', '白虎', 38, '11.9%'],
        ['支离', 30, '10.1%', '千叶', 14, '4.7%', '真朱雀', 34, '11.4%', '真白虎', 27, '9.7%'],
        ['镇龙', 27, '9.1%', '/', 10, '3.4%', '相思', 26, '8.8%', '捕神', 18, '7.1%'],
        ['破阵', 26, '8.8%', '天机', 10, '3.4%', '真凌霄', 26, '8.8%', '/', 8, '1.8%'],
        ['紫啸', 19, '6.4%', '鲲鹏', 7, '2.4%', '凌霄', 22, '7.4%', '天音', 1, '0.4%'],
        ['摘音', 15, '5.1%', '玄武袍', 4, '1.3%', '凤鸣', 19, '6.4%', '', '', ''],
        ['/', 13, '4.4%', '', '', '', '妙法', 15, '5.1%', '', '', ''],
        ['奔雷', 11, '3.7%', '', '', '', '/', 12, '4.0%', '', '', ''],
        ['青龙', 9, '3.0%', '', '', '', '朱雀', 6, '2.0%', '', '', ''],
        ['伏魔', 7, '2.4%', '', '', '', '捕神', 5, '1.7%', '', '', ''],
        ['鸿鸣', 4, '1.3%', '', '', '', '寒玉', 3, '1.0%', '', '', ''],
        ['绿玉', 4, '1.3%', '', '', '', '', '', '', '', '', ''],
        ['青虹', 2, '0.7%', '', '', '', '', '', '', '', '', ''],
        ['降魔', 1, '0.3%', '', '', '', '', '', '', '', '', ''],
        ['绝命', 1, '0.3%', '', '', '', '', '', '', '', '', ''],
        ['君子', 1, '0.3%', '', '', '', '', '', '', '', '', ''],
        ['万人', 1, '0.3%', '', '', '', '', '', '', '', '', ''],
        ['邪影', 1, '0.3%', '', '', '', '', '', '', '', '', ''],
      ],
      note: '原表中使用非 S 级装备的项目统一记作“/”。',
    },
    miegu_followers: {
      columns: ['序号', '人物', '出场次', '出场率'],
      rows: [
        [0, '主', 33, '100.0%'],
        [1, '顾言', 32, '97.0%'],
        [2, '神秘女侠', 31, '93.9%'],
        [3, '林清舞', 27, '81.8%'],
        [4, '宗泽', 25, '75.8%'],
        [5, '穆云缨', 24, '72.7%'],
        [6, '唐雨晨', 22, '66.7%'],
        [7, '蔡半仙', 18, '54.5%'],
        [8, '杜月寒', 15, '45.5%'],
        [9, '苏念雪', 13, '39.4%'],
        [10, '厉若海', 10, '27.8%'],
        [11, '石映寒', 10, '30.3%'],
        [12, '胡休', 9, '33.3%'],
        [13, '张祁连', 7, '21.2%'],
        [14, '芙蓉夏蝉', 5, '11.1%'],
        [15, '商昊乾', 5, '15.2%'],
        [16, '叶神机', 3, '9.1%'],
        [17, '柳如意', 2, '6.1%'],
        [18, '清月', 2, '6.1%'],
        [19, '荆枫', 2, '6.1%'],
        [20, '莫声谷', 1, '3.0%'],
        [21, '竹心', 1, '3.0%'],
      ],
      note: '随从细项已按人物拆分为可展开的武学与内功表格；页面不再加载原图。',
    },
  };

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
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function saveAchievementProgress() {
    try {
      localStorage.setItem(ACHIEVEMENT_PROGRESS_KEY, JSON.stringify(achievementProgress));
    } catch {
      // Achievement tracking remains usable for the current session if storage is unavailable.
    }
  }

  function toggleAchievement(id) {
    const key = String(id || '');
    if (!key) return;
    achievementProgress[key] = !achievementProgress[key];
    saveAchievementProgress();
    renderAchievements();
  }

  function renderAchievements() {
    const list = document.getElementById('achievements-list');
    const count = document.getElementById('achievements-count');
    if (!list || !count) return;
    const completed = ACHIEVEMENT_RECORDS.filter((item) => achievementProgress[item.id]).length;
    count.textContent = `${completed} / ${ACHIEVEMENT_RECORDS.length} 项`;
    if (!ACHIEVEMENT_RECORDS.length) {
      list.innerHTML = '<div class="v03-achievements-empty"><strong>静待更新</strong></div>';
      return;
    }
    list.innerHTML = ACHIEVEMENT_RECORDS.map((item) => `
      <label class="v03-achievement-item${achievementProgress[item.id] ? ' is-complete' : ''}">
        <input type="checkbox" data-achievement-id="${escapeHtml(item.id)}"${achievementProgress[item.id] ? ' checked' : ''}>
        <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || '')}</small></span>
      </label>
    `).join('');
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
    const active = Boolean(window.jianghuEncyclopedia?.getFavoriteEntries?.().some((item) => item.key === id));
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
      { id: 'pitfalls', title: '避坑指南', author: '@邩木', icon: 'alert', tone: 'red', source: 'Excel 汇总', summary: '开局选择、任务道具、令牌和版本机制的易错点。', meta: `${directoryData.pitfalls?.length || 11} 条注意事项` },
      { id: 'recipes', title: '菜谱大全', author: '@邩木', icon: 'food', tone: 'gold', source: '腾讯文档 · 菜谱配方', summary: '按线上原件整理的菜名与材料配方。', meta: `${recipes.length} 道菜谱记录` },
      { id: 'original-search', title: '原版攻略检索', icon: 'search', tone: 'red', source: 'DOCX 检索索引', summary: '只检索原版攻略 DOCX 的任务、NPC、地点和关键词。', meta: `${docxCount || 221} 条原攻略分块` },
      { id: 'longgu-outer-points', title: '龙谷外围点位', icon: 'map', tone: 'gold', source: '专题攻略', summary: '灭谷相关 Boss 的外围坐标与标记信息。', meta: strategyCount('longgu-outer-points') },
      { id: 'miegu-lineup-summary', title: '灭谷阵容汇总', author: '@染羽', icon: 'formation', tone: 'red', source: '专题攻略', summary: '武学、内功、装备与随从出场数据。', meta: strategyCount('miegu-lineup-summary') },
      { id: 'white-rabbit-martial-rating', title: '白兔 2.83 武功评级', author: '@染羽', icon: 'sword', tone: 'gold', source: '专题攻略', summary: '白兔 2.83 孤本武学强度梯度与个人向文字评级。', meta: strategyCount('white-rabbit-martial-rating') },
      { id: 'wudao-insight-exchange', title: '武道感悟兑换攻略', author: '染羽', icon: 'info', tone: 'red', source: '文字整理', summary: '武道感悟的获取方式、使用提醒与内功兑换路径。', meta: strategyCount('wudao-insight-exchange') },
      { id: 'update-logs', title: '更新日志', icon: 'info', tone: 'gray', source: '白兔更新日志', summary: '按版本倒序查看游戏更新内容。', meta: `${guideState.updateLogs?.logs?.length || 0} 个版本` },
      { id: 'version-notes', title: '版本规则', icon: 'info', tone: 'gray', source: '白兔版数据', summary: '速度条、状态阈值、技艺和任督等基础规则。', meta: `${data.guide_notes?.length || 0} 条版本提示` },
    ];
  }

  function renderGuideDirectory() {
    const list = document.getElementById('guide-directory');
    if (!list) return;
    list.innerHTML = getGuideCatalog().map((item) => `
      <button class="v03-guide-directory-card" type="button" data-guide-id="${escapeHtml(item.id)}">
        ${iconSvg(item.icon, item.tone)}
        <span class="v03-guide-directory-copy"><small>${escapeHtml(item.author ? `作者：${item.author}` : item.source)}</small><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.summary)}</em><b>${escapeHtml(item.meta)}</b></span>
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
      ? '<p class="v03-guide-freshness-note">PS：攻略具有时效性，随时可能因为版本更新而发生变化，查询时请注意时间。</p>'
      : '';
    const isLibrary = item.id === 'original-search';
    title.innerHTML = `<div class="v03-guide-detail-title-row${isLibrary ? '' : ' has-favorite'}">${iconSvg(item.icon, item.tone)}<div><p class="section-kicker">${escapeHtml(item.author ? `作者：${item.author}` : item.source)}</p><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p>${freshnessNote}</div>${isLibrary ? '' : guideFavoriteButton(`guide:${item.id}`, item.title)}</div>`;
  }

  function renderPitfalls() {
    return `<div class="v03-guide-note-list">${(directoryData.pitfalls || []).map((item) => {
      const title = item.title.replace(/^第一项：|^第二项：|^第三项：|^第四项：|^第五项：|^第六项：|^第七项：|^第八项：|^第九项：|^第十项：|^第十一项：/, '');
      const warning = item.warning ? `<strong class="v03-guide-warning">${escapeHtml(item.warning)}</strong>` : '';
      return `<article class="v03-guide-note-card${item.warning ? ' is-warning' : ''}"><span class="v03-guide-note-index">${escapeHtml(item.title.split('：')[0])}</span><div><h3>${escapeHtml(title)}</h3>${warning}<p>${escapeHtml(item.text)}</p></div></article>`;
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
      count.textContent = '索引加载中';
      result.innerHTML = '<p class="v03-guide-empty">正在读取离线索引…</p>';
      return;
    }
    count.textContent = guideState.searchQuery ? `匹配 ${filtered.length} 条，展示前 20 条` : `推荐 ${filtered.length} 条支线记录 · 输入关键词检索全部 ${records.length} 条`;
    const visible = filtered.slice(0, 20);
    result.innerHTML = visible.length ? visible.map((item) => `<article class="v03-guide-search-result" data-guide-record-id="${escapeHtml(item.id)}"><div class="v03-guide-result-top"><strong>${escapeHtml(originalDisplayText(item.title || '未命名条目'))}</strong><span>${escapeHtml(originalDisplayText(item.section || item.category || '攻略'))}</span>${guideFavoriteButton(`chunk:${item.id}`, originalDisplayText(item.title || '攻略条目'))}</div><p>${escapeHtml(originalDisplayText(item.text || ''))}</p><small>${escapeHtml(item.source_label || item.source || '')}${item.source_version ? ` · ${escapeHtml(item.source_version)}` : ''}</small></article>`).join('') : '<p class="v03-guide-empty">没有匹配内容，换一个任务名、NPC 或地点试试。</p>';
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
    const guideItems = [...guideFavorites].map((key) => {
      if (key.startsWith('guide:')) {
        const item = catalog.find((entry) => `guide:${entry.id}` === key);
        return item ? { key, type: 'guide', title: item.title, meta: item.source, guideId: item.id } : null;
      }
      if (key.startsWith('chunk:')) {
        const item = chunks.find((entry) => `chunk:${entry.id}` === key);
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
        <button type="button" class="v03-home-favorite-open" data-home-favorite-type="${item.type}" data-home-favorite-guide="${item.guideId || ''}" data-home-favorite-chunk="${item.record?.id || ''}" data-home-favorite-encyclopedia-type="${item.encyclopediaType || ''}" data-home-favorite-record="${item.recordId || ''}">
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

  const FOLLOWER_DETAILS = [
    ['主', [['—', '—', '—']], [['—', '—', '—']]],
    ['顾言', [['大同', 16, '50.0%'], ['达摩剑', 7, '21.9%'], ['谪仙', 4, '12.5%'], ['追风', 4, '12.5%'], ['转魄', 1, '3.1%']], [['玄同', 31, '96.9%'], ['镇狱', 1, '3.1%']]],
    ['神秘女侠', [['转魄', 11, '35.5%'], ['千霜', 7, '22.6%'], ['中平', 5, '16.1%'], ['追风', 3, '9.7%'], ['达摩剑', 1, '3.2%'], ['独孤', 1, '3.2%'], ['玄天', 1, '3.2%'], ['倚天', 1, '3.2%'], ['真武', 1, '3.2%']], [['太和', 22, '71.0%'], ['/', 5, '16.1%'], ['达摩', 2, '6.5%'], ['渊海', 1, '3.2%'], ['镇狱', 1, '3.2%']]],
    ['林清舞', [['般若', 14, '51.9%'], ['无极拳', 5, '18.5%'], ['曜日', 4, '14.8%'], ['蛊掌', 3, '11.1%'], ['追命', 1, '3.7%']], [['易筋', 11, '40.7%'], ['纯阳', 6, '22.2%'], ['离火', 4, '14.8%'], ['金莲', 3, '11.1%'], ['太和', 2, '7.4%'], ['达摩', 1, '3.7%']]],
    ['宗泽', [['千山', 9, '36.0%'], ['佛刀', 8, '32.0%'], ['关山', 7, '28.0%'], ['破锋', 1, '4.0%']], [['太和', 9, '36.0%'], ['离火', 7, '28.0%'], ['达摩', 6, '24.0%'], ['易筋', 2, '8.0%'], ['镇狱', 1, '4.0%']]],
    ['穆云缨', [['达摩杖', 9, '37.5%'], ['打狗', 7, '29.2%'], ['千钧', 5, '20.8%'], ['沧澜', 2, '8.3%'], ['天狼', 1, '4.2%']], [['达摩', 11, '45.8%'], ['太和', 9, '37.5%'], ['斗转', 2, '8.3%'], ['寂影', 2, '8.3%']]],
    ['唐雨晨', [['千霜', 9, '40.9%'], ['中平', 8, '36.4%'], ['七星', 1, '4.5%'], ['青莲', 1, '4.5%'], ['谪仙', 1, '4.5%'], ['真武', 1, '4.5%'], ['追风', 1, '4.5%']], [['/', 11, '50.0%'], ['太和', 9, '40.9%'], ['渊海', 1, '4.5%'], ['斗转', 1, '4.5%']]],
    ['蔡半仙', [['蛊掌', 16, '88.9%'], ['曜日', 1, '5.6%'], ['定珠', 1, '5.6%']], [['离火', 16, '88.9%'], ['太和', 1, '5.6%'], ['乘云', 1, '5.6%']]],
    ['杜月寒', [['达摩剑', 13, '86.7%'], ['追风', 1, '6.7%'], ['转魄', 1, '6.7%']], [['太和', 7, '46.7%'], ['达摩', 3, '20.0%'], ['斗转', 1, '6.7%'], ['寂影', 1, '6.7%'], ['金莲', 1, '6.7%'], ['先天', 1, '6.7%'], ['镇狱', 1, '6.7%']]],
    ['苏念雪', [['谪仙', 5, '38.5%'], ['云崖', 4, '30.8%'], ['追风', 2, '15.4%'], ['达摩剑', 1, '7.7%'], ['倚天', 1, '7.7%']], [['太和', 11, '84.6%'], ['白兔', 1, '7.7%'], ['金莲', 1, '7.7%']]],
    ['厉若海', [['关山', 7, '70.0%'], ['斩天', 3, '30.0%']], [['达摩', 6, '60.0%'], ['镇狱', 2, '20.0%'], ['蔷薇', 1, '10.0%'], ['太和', 1, '10.0%']]],
    ['石映寒', [['降龙', 9, '87.5%'], ['六脉', 1, '12.5%']], [['太玄', 10, '100.0%']]],
    ['胡休', [['蛊掌', 6, '66.7%'], ['万躯', 2, '22.2%'], ['碧波', 1, '11.1%']], [['斗转', 7, '77.8%'], ['九阳', 1, '11.1%'], ['离火', 1, '11.1%']]],
    ['张祁连', [['追命', 6, '85.7%'], ['光明', 1, '14.3%']], [['噬心', 6, '85.7%'], ['太和', 1, '14.3%']]],
    ['芙蓉夏蝉', [['无极剑', 3, '60.0%'], ['转魄', 2, '40.0%']], [['纯阳', 2, '40.0%'], ['太和', 2, '40.0%'], ['太玄', 1, '20.0%']]],
    ['商昊乾', [['关山', 4, '80.0%'], ['千山', 1, '20.0%']], [['达摩', 3, '60.0%'], ['寂影', 1, '20.0%'], ['太和', 1, '20.0%']]],
    ['叶神机', [['沧澜', 1, '33.3%'], ['达摩杖', 1, '33.3%'], ['打狗', 1, '33.3%']], [['太和', 2, '66.7%'], ['先天', 1, '33.3%']]],
    ['柳如意', [['达摩剑', 1, '50.0%'], ['谪仙', 1, '50.0%']], [['斗转', 1, '50.0%'], ['太和', 1, '50.0%']]],
    ['清月', [['追风', 2, '100.0%']], [['金莲', 2, '100.0%']]],
    ['荆枫', [['三仙', 2, '100.0%']], [['达摩', 2, '100.0%']]],
    ['莫声谷', [['两仪', 1, '100.0%']], [['/', 1, '100.0%']]],
    ['竹心', [['蛊掌', 1, '100.0%']], [['斗转', 1, '100.0%']]],
  ];

  const LINEUP_COLUMNS = ['随从', '武学', '内功', '武器', '护甲', '戒指', '护腕'];
  const LINEUP_DIRECTORY = [
    {
      title: '男刀绝世棍',
      author: '染羽',
      rows: [
        ['主', '关山', '达摩', '青龙', '真玄武', '凤鸣', '赤鬼'],
        ['宗泽', '佛刀', '离火', '鸿鸣', '虎魄', '轩辕', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '千叶', '倾心', '赤鬼'],
        ['苏念雪', '谪仙', '太和', '摘音', '虎魄', '朱雀', '赤鬼'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '轩辕', '碧麟'],
        ['穆云缨', '千钧', '达摩', '破阵', '虎魄', '真凌霄', '真白虎'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '真朱雀', '赤鬼'],
        ['神秘女侠', '转魄', '太和', '玄阴', '虎魄', '捕神', '捕神'],
        ['芙蓉夏蝉', '无极剑', '纯阳', '青虹', '玄武甲', '倾心', '白虎'],
      ],
    },
    {
      title: '男刀后宫',
      author: '染羽',
      rows: [
        ['主', '关山', '达摩', '青龙', '真玄武', '凤鸣', '赤鬼'],
        ['顾言', '达摩剑', '玄同', '无锋', '千叶', '轩辕', '赤鬼'],
        ['宗泽', '佛刀', '离火', '伏魔', '虎魄', '轩辕', '碧麟'],
        ['张祁连', '光明', '太和', '紫啸', '虎魄', '倾心', '碧麟'],
        ['穆云缨', '达摩杖', '达摩', '破阵', '虎魄', '真凌霄', '真白虎'],
        ['清月', '追风', '金莲', '玄阴', '虎魄', '倾心', '捕神'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '真朱雀', '赤鬼'],
        ['神秘女侠', '转魄', '达摩', '玄阴', '虎魄', '捕神', '碧麟'],
        ['胡休', '蛊掌', '斗转', '血爪', '虎魄', '凌霄', '白虎'],
      ],
    },
    {
      title: '女刀绝世刀',
      author: 'tln',
      rows: [
        ['主', '斩天', '镇狱', '青龙', '鲲鹏', '真朱雀', '赤鬼'],
        ['神秘女侠', '独孤', '太和', '支离', '虎魄', '相思', '碧麟'],
        ['蔡半仙', '定珠', '乘云', '血爪', '虎魄', '凌霄', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '玄武袍', '相思', '真白虎'],
        ['宗泽', '千山', '达摩', '鸿鸣', '虎魄', '倾心', '碧麟'],
        ['林清舞', '无极拳', '纯阳', '紫啸', '真玄武', '倾心', '捕神'],
        ['胡休', '蛊掌', '斗转', '血爪', '虎魄', '凌霄', '碧麟'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '凤鸣', '赤鬼'],
        ['苏念雪', '云崖', '太和', '支离', '虎魄', '妙法', '碧麟'],
      ],
    },
    {
      title: '女刀后宫',
      author: '原图署名',
      rows: [
        ['主', '关山', '金莲', '鸿鸣', '鲲鹏', '真朱雀', '赤鬼'],
        ['莫声谷', '两仪', '/', '/', '/', '/', '天音'],
        ['叶神机', '打狗', '先天', '绿玉', '虎魄', '真凌霄', '白虎'],
        ['顾言', '谪仙', '玄同', '支离', '虎魄', '倾心', '白虎'],
        ['柳如意', '达摩剑', '斗转', '摘音', '真玄武', '妙法', '真白虎'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '森罗', '捕神'],
        ['唐雨晨', '中平', '/', '无锋', '虎魄', '凌霄', '碧麟'],
        ['神秘女侠', '真武', '太和', '玄阴', '虎魄', '森罗', '碧麟'],
        ['杜月寒', '追风', '达摩', '玄阴', '虎魄', '倾心', '碧麟'],
      ],
    },
    {
      title: '男棍绝世棍',
      author: '新',
      rows: [
        ['主', '千钧', '镇狱', '破阵', '真玄武', '真朱雀', '真白虎'],
        ['顾言', '谪仙', '玄同', '无锋', '玄武甲', '轩辕', '赤鬼'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '真凌霄', '碧麟'],
        ['厉若海', '关山', '达摩', '镇龙', '虎魄', '倾心', '碧麟'],
        ['林清舞', '般若', '太和', '血爪', '虎魄', '相思', '碧麟'],
        ['穆云缨', '达摩杖', '达摩', '破阵', '虎魄', '轩辕', '碧麟'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '凤鸣', '赤鬼'],
        ['唐雨晨', '千霜', '太和', '支离', '虎魄', '凌霄', '碧麟'],
        ['神秘女侠', '千霜', '太和', '支离', '虎魄', '凌霄', '碧麟'],
      ],
    },
    {
      title: '男剑绝世内',
      author: '无限神话',
      rows: [
        ['主', '追风', '白兔', '玄阴', '千叶', '真朱雀', '白虎'],
        ['顾言', '大同', '玄同', '无锋', '虎魄', '倾心', '赤鬼'],
        ['宗泽', '关山', '达摩', '镇龙', '虎魄', '相思', '碧麟'],
        ['穆云缨', '打狗', '太和', '万人', '真玄武', '倾心', '捕神'],
        ['杜月寒', '达摩剑', '先天', '玄阴', '虎魄', '凌霄', '碧麟'],
        ['苏念雪', '谪仙', '太和', '摘音', '虎魄', '轩辕', '碧麟'],
        ['林清舞', '蛊掌', '离火', '血爪', '虎魄', '真凌霄', '碧麟'],
        ['唐雨晨', '中平', '/', '青虹', '鲲鹏', '轩辕', '白虎'],
        ['神秘女侠', '中平', '/', '支离', '虎魄', '轩辕', '碧麟'],
      ],
    },
    {
      title: '男剑绝世剑',
      author: '地三鲜剑 / 主苏沐枫',
      rows: [
        ['主', '三仙', '先天', '玄阴', '千叶', '真朱雀', '碧麟'],
        ['苏念雪', '谪仙', '太和', '摘音', '虎魄', '相思', '真白虎'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '真玄武', '相思', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '虎魄', '倾心', '白虎'],
        ['林清舞', '般若', '易筋', '血爪', '虎魄', '轩辕', '捕神'],
        ['宗泽', '佛刀', '太和', '伏魔', '虎魄', '倾心', '碧麟'],
        ['杜月寒', '达摩剑', '太和', '支离', '虎魄', '真凌霄', '碧麟'],
        ['唐雨晨', '中平', '/', '君子', '虎魄', '森罗', '碧麟'],
        ['神秘女侠', '中平', '/', '/', '/', '/', '/'],
      ],
    },
    {
      title: '女剑绝世棍',
      author: '绿豆冰沙',
      rows: [
        ['主', '追风', '镇狱', '玄阴', '虎魄', '真朱雀', '赤鬼'],
        ['顾言', '达摩剑', '玄同', '无锋', '虎魄', '森罗', '白虎'],
        ['苏念雪', '云崖', '太和', '玄阴', '虎魄', '倾心', '捕神'],
        ['林清舞', '无极拳', '纯阳', '血爪', '虎魄', '真凌霄', '碧麟'],
        ['商昊乾', '关山', '太和', '镇龙', '虎魄', '凤鸣', '碧麟'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '妙法', '碧麟'],
        ['穆云缨', '千钧', '达摩', '破阵', '真玄武', '倾心', '碧麟'],
        ['宗泽', '千山', '太和', '镇龙', '虎魄', '相思', '碧麟'],
        ['神秘女侠', '千霜', '太和', '支离', '虎魄', '朱雀', '碧麟'],
      ],
    },
    {
      title: '太监绝世内',
      author: '玄阴教主 / 顾言宴',
      rows: [
        ['主', '辟邪', '葵花', '玄阴', '真玄武', '真凌霄', '赤鬼'],
        ['苏念雪', '追风', '白兔', '玄阴', '虎魄', '倾心', '碧麟'],
        ['神秘女侠', '转魄', '太和', '玄阴', '虎魄', '凤鸣', '碧麟'],
        ['宗泽', '关山', '达摩', '镇龙', '虎魄', '真朱雀', '真白虎'],
        ['穆云缨', '打狗', '太和', '绿玉', '虎魄', '轩辕', '捕神'],
        ['杜月寒', '达摩剑', '太和', '玄阴', '虎魄', '森罗', '碧麟'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '倾心', '碧麟'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '相思', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '千叶', '森罗', '白虎'],
      ],
    },
    {
      title: '太监绝世棍',
      author: '草莓啵啵酱',
      rows: [
        ['主', '辟邪', '葵花', '玄阴', '玄武甲', '倾心', '赤鬼'],
        ['神秘女侠', '千霜', '太和', '支离', '虎魄', '相思', '赤鬼'],
        ['石映寒', '六脉', '太玄', '奔雷', '天机', '森罗', '赤鬼'],
        ['芙蓉夏蝉', '无极剑', '太玄', '支离', '虎魄', '轩辕', '碧麟'],
        ['厉若海', '关山', '镇狱', '镇龙', '虎魄', '相思', '碧麟'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '轩辕', '碧麟'],
        ['穆云缨', '千钧', '达摩', '破阵', '真玄武', '真凌霄', '真白虎'],
        ['顾言', '大同', '玄同', '无锋', '千叶', '真朱雀', '白虎'],
        ['宗泽', '佛刀', '离火', '伏魔', '虎魄', '凤鸣', '碧麟'],
      ],
    },
    {
      title: '太监绝世拳',
      author: '1',
      rows: [
        ['主', '辟邪', '葵花', '玄阴', '真玄武', '倾心', '碧麟'],
        ['张祁连', '追命', '噬心', '紫啸', '真玄武', '真朱雀', '赤鬼'],
        ['宗泽', '关山', '达摩', '镇龙', '虎魄', '真凌霄', '真白虎'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '轩辕', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '千叶', '倾心', '白虎'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '寒玉', '捕神'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '凤鸣', '赤鬼'],
        ['神秘女侠', '转魄', '太和', '摘音', '虎魄', '寒玉', '碧麟'],
        ['穆云缨', '达摩杖', '达摩', '破阵', '虎魄', '轩辕', '碧麟'],
      ],
    },
    {
      title: '女棍绝世剑',
      author: 'Koi',
      rows: [
        ['主', '打狗', '达摩', '破阵', '虎魄', '妙法', '碧麟'],
        ['神秘女侠', '追风', '太和', '玄阴', '虎魄', '轩辕', '碧麟'],
        ['荆枫', '三仙', '达摩', '玄阴', '真玄武', '真凌霄', '赤鬼'],
        ['杜月寒', '达摩剑', '斗转', '支离', '虎魄', '倾心', '捕神'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '森罗', '碧麟'],
        ['宗泽', '关山', '镇狱', '镇龙', '虎魄', '真朱雀', '碧麟'],
        ['穆云缨', '沧澜', '寂影', '破阵', '虎魄', '倾心', '碧麟'],
        ['顾言', '转魄', '玄同', '无锋', '天机', '凤鸣', '赤鬼'],
        ['唐雨晨', '中平', '/', '/', '/', '/', '/'],
      ],
    },
    {
      title: '男刀绝世刀',
      author: '纯',
      rows: [
        ['主', '斩天', '镇狱', '青龙', '鲲鹏', '真朱雀', '赤鬼'],
        ['顾言', '达摩剑', '玄同', '无锋', '玄武袍', '朱雀', '真白虎'],
        ['宗泽', '佛刀', '太和', '镇龙', '虎魄', '倾心', '捕神'],
        ['林清舞', '般若', '易筋', '血爪', '虎魄', '轩辕', '白虎'],
        ['苏念雪', '谪仙', '太和', '摘音', '真玄武', '轩辕', '白虎'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '相思', '碧麟'],
        ['胡休', '万躯', '斗转', '血爪', '虎魄', '森罗', '碧麟'],
        ['神秘女侠', '转魄', '太和', '玄阴', '虎魄', '朱雀', '碧麟'],
        ['唐雨晨', '青莲', '/', '支离', '千叶', '朱雀', '碧麟'],
      ],
    },
    {
      title: '女棍绝世棍',
      author: '十一',
      rows: [
        ['主', '千钧', '太和', '破阵', '虎魄', '森罗', '赤鬼'],
        ['胡休', '蛊掌', '斗转', '血爪', '虎魄', '妙法', '白虎'],
        ['厉若海', '关山', '达摩', '青龙', '真玄武', '真朱雀', '真白虎'],
        ['柳如意', '谪仙', '太和', '摘音', '玄武甲', '真凌霄', '白虎'],
        ['林清舞', '曜日', '金莲', '紫啸', '虎魄', '倾心', '碧麟'],
        ['宗泽', '千山', '离火', '镇龙', '虎魄', '倾心', '碧麟'],
        ['穆云缨', '达摩杖', '太和', '破阵', '虎魄', '森罗', '碧麟'],
        ['顾言', '追风', '玄同', '无锋', '玄武甲', '森罗', '赤鬼'],
        ['神秘女侠', '转魄', '太和', '支离', '虎魄', '凤鸣', '碧麟'],
      ],
    },
    {
      title: '男剑后宫',
      author: '玄阴教主 / 顾言宴',
      rows: [
        ['主', '达摩剑', '镇狱', '玄阴', '虎魄', '真凌霄', '捕神'],
        ['厉若海', '关山', '达摩', '青龙', '真玄武', '真朱雀', '真白虎'],
        ['宗泽', '千山', '离火', '伏魔', '虎魄', '森罗', '碧麟'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '轩辕', '碧麟'],
        ['顾言', '谪仙', '玄同', '无锋', '千叶', '倾心', '白虎'],
        ['清月', '追风', '金顶', '玄阴', '虎魄', '森罗', '碧麟'],
        ['唐雨晨', '千霜', '太和', '支离', '虎魄', '/', '碧麟'],
        ['神秘女侠', '千霜', '太和', '支离', '虎魄', '相思', '碧麟'],
        ['穆云缨', '打狗', '斗转', '降魔', '虎魄', '倾心', '碧麟'],
      ],
    },
    {
      title: '女刀神兵',
      author: '染羽',
      rows: [
        ['主', '关山', '达摩', '青龙', '真玄武', '真朱雀', '赤鬼'],
        ['神秘女侠', '转魄', '达摩', '玄阴', '虎魄', '捕神', '碧麟'],
        ['苏念雪', '追风', '太和', '玄阴', '虎魄', '倾心', '捕神'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '凤鸣', '赤鬼'],
        ['胡休', '蛊掌', '斗转', '血爪', '虎魄', '凌霄', '白虎'],
        ['宗泽', '千山', '离火', '镇龙', '虎魄', '真朱雀', '碧麟'],
        ['穆云缨', '天狼', '达摩', '破阵', '虎魄', '真凌霄', '真白虎'],
        ['顾言', '达摩剑', '玄同', '无锋', '玄武甲', '倾心', '碧麟'],
        ['唐雨晨', '真武', '/', '/', '鲲鹏', '轩辕', '赤鬼'],
      ],
    },
    {
      title: '女棍神兵',
      author: '新',
      rows: [
        ['主', '天狼', '镇狱', '破阵', '虎魄', '真朱雀', '赤鬼'],
        ['顾言', '谪仙', '玄同', '无锋', '虎魄', '倾心', '真白虎'],
        ['林清舞', '无极拳', '纯阳', '血爪', '虎魄', '妙法', '碧麟'],
        ['杜月寒', '达摩剑', '太和', '摘音', '真玄武', '倾心', '碧麟'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '真凌霄', '碧麟'],
        ['唐雨晨', '千霜', '太和', '玄阴', '虎魄', '凌霄', '碧麟'],
        ['神秘女侠', '千霜', '太和', '支离', '虎魄', '凌霄', '碧麟'],
        ['胡休', '万躯', '斗转', '血爪', '虎魄', '凌霄', '碧麟'],
        ['宗泽', '关山', '太和', '镇龙', '虎魄', '相思', '碧麟'],
      ],
    },
    {
      title: '男棍绝世刀',
      author: '107 次出关山月',
      rows: [
        ['主', '天狼', '镇狱', '破阵', '虎魄', '真朱雀', '赤鬼'],
        ['神秘女侠', '追风', '太和', '玄阴', '虎魄', '凤鸣', '碧麟'],
        ['房若海', '斩天', '达摩', '镇龙', '真玄武', '真凌霄', '真白虎'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '凌霄', '碧麟'],
        ['林清舞', '般若', '纯阳', '血爪', '虎魄', '凌霄', '碧麟'],
        ['宗泽', '佛刀', '太和', '鸿鸣', '虎魄', '相思', '碧麟'],
        ['穆云缨', '达摩杖', '太和', '破阵', '虎魄', '倾心', '碧麟'],
        ['顾言', '达摩剑', '玄同', '无锋', '千叶', '轩辕', '碧麟'],
        ['唐雨晨', '千霜', '太和', '摘音', '虎魄', '倾心', '碧麟'],
      ],
    },
    {
      title: '女剑绝世拳',
      author: '有人@你',
      rows: [
        ['主', '倚天', '金莲', '玄阴', '虎魄', '妙法', '真白虎'],
        ['顾言', '大同', '玄同', '无锋', '玄武甲', '倾心', '白虎'],
        ['张祁连', '追命', '噬心', '绝命', '真玄武', '倾心', '白虎'],
        ['商昊乾', '千山', '达摩', '镇龙', '虎魄', '森罗', '碧麟'],
        ['蔡半仙', '曜日', '离火', '血爪', '虎魄', '真朱雀', '碧麟'],
        ['唐雨晨', '七星', '/', '玄阴', '/', '凤鸣', '白虎'],
        ['神秘女侠', '达摩剑', '镇狱', '支离', '虎魄', '真凌霄', '碧麟'],
        ['穆云缨', '打狗', '斗转', '破阵', '虎魄', '相思', '碧麟'],
        ['芙蓉夏蝉', '转魄', '太和', '玄阴', '虎魄', '森罗', '碧麟'],
      ],
    },
    {
      title: '男刀绝世拳',
      author: '陆月半',
      rows: [
        ['主', '关山', '斗转', '镇龙', '真玄武', '真朱雀', '碧麟'],
        ['宗泽', '佛刀', '易筋', '伏魔', '虎魄', '森罗', '碧麟'],
        ['林清舞', '般若', '易筋', '血爪', '虎魄', '轩辕', '碧麟'],
        ['张祁连', '追命', '噬心', '紫啸', '虎魄', '真凌霄', '真白虎'],
        ['顾言', '达摩剑', '镇狱', '玄阴', '虎魄', '倾心', '碧麟'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '相思', '碧麟'],
        ['穆云缨', '达摩杖', '达摩', '破阵', '虎魄', '倾心', '碧麟'],
        ['神秘女侠', '中平', '/', '/', '/', '/', '/'],
        ['唐雨晨', '中平', '/', '/', '/', '/', '/'],
      ],
    },
    {
      title: '男拳绝世棍',
      author: 'tln',
      rows: [
        ['主', '万躯', '斗转', '血爪', '玄武甲', '凌霄', '赤鬼'],
        ['宗泽', '千山', '易筋', '镇龙', '虎魄', '真朱雀', '碧麟'],
        ['穆云缨', '千钧', '达摩', '破阵', '真玄武', '倾心', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '千叶', '寒玉', '真白虎'],
        ['林清舞', '般若', '离火', '血爪', '虎魄', '真凌霄', '白虎'],
        ['蔡半仙', '蛊掌', '太和', '血爪', '虎魄', '凌霄', '碧麟'],
        ['苏念雪', '云崖', '太和', '支离', '虎魄', '相思', '碧麟'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '捕神', '赤鬼'],
        ['叶神机', '达摩杖', '太和', '破阵', '虎魄', '凤鸣', '捕神'],
      ],
    },
    {
      title: '女刀绝世拳',
      author: '瓦尼·法伦泰',
      rows: [
        ['主', '千山', '达摩', '镇龙', '虎魄', '妙法', '白虎'],
        ['宗泽', '关山', '达摩', '镇龙', '虎魄', '倾心', '碧麟'],
        ['顾言', '大同', '玄同', '支离', '虎魄', '轩辕', '白虎'],
        ['张祁连', '追命', '噬心', '紫啸', '真玄武', '真朱雀', '真白虎'],
        ['穆云缨', '打狗', '达摩', '破阵', '虎魄', '轩辕', '碧麟'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '森罗', '碧麟'],
        ['林清舞', '无极拳', '纯阳', '奔雷', '虎魄', '轩辕', '碧麟'],
        ['唐雨晨', '追风', '斗转', '支离', '虎魄', '轩辕', '碧麟'],
        ['神秘女侠', '倚天', '太和', '无锋', '虎魄', '森罗', '白虎'],
      ],
    },
    {
      title: '男剑绝世拳',
      author: '灵泽',
      rows: [
        ['主', '追风', '镇狱', '玄阴', '虎魄', '倾心', '碧麟'],
        ['张祁连', '追命', '噬心', '紫啸', '真玄武', '真朱雀', '真白虎'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '轩辕', '碧麟'],
        ['宗泽', '佛刀', '太和', '伏魔', '虎魄', '森罗', '捕神'],
        ['顾言', '大同', '玄同', '无锋', '千叶', '倾心', '赤鬼'],
        ['杜月寒', '达摩剑', '太和', '支离', '虎魄', '凤鸣', '碧麟'],
        ['胡休', '蛊掌', '斗转', '血爪', '虎魄', '森罗', '碧麟'],
        ['穆云缨', '达摩杖', '太和', '破阵', '虎魄', '森罗', '碧麟'],
        ['神秘女侠', '玄天', '太和', '摘音', '虎魄', '森罗', '碧麟'],
      ],
    },
    {
      title: '男剑绝世刀',
      author: '原图未标注',
      rows: [
        ['主', '倚天', '达摩', '玄阴', '真玄武', '真凌霄', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '玄武甲', '倾心', '赤鬼'],
        ['房若海', '关山', '达摩', '邪影', '虎魄', '倾心', '碧麟'],
        ['杜月寒', '达摩剑', '达摩', '玄阴', '虎魄', '妙法', '真白虎'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '轩辕', '捕神'],
        ['唐雨晨', '千霜', '太和', '支离', '虎魄', '轩辕', '碧麟'],
        ['神秘女侠', '转魄', '太和', '支离', '虎魄', '凌霄', '碧麟'],
        ['宗泽', '关山', '太和', '伏魔', '虎魄', '相思', '碧麟'],
        ['穆云缨', '沧澜', '太和', '破阵', '虎魄', '森罗', '碧麟'],
      ],
    },
    {
      title: '女剑后宫',
      author: '陆月半',
      rows: [
        ['主', '倚天', '达摩', '玄阴', '真玄武', '真凌霄', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '玄武甲', '倾心', '赤鬼'],
        ['房若海', '关山', '达摩', '邪影', '虎魄', '倾心', '碧麟'],
        ['杜月寒', '达摩剑', '达摩', '玄阴', '虎魄', '妙法', '真白虎'],
        ['宗泽', '千山', '达摩', '镇龙', '虎魄', '森罗', '碧麟'],
        ['林清舞', '蛊掌', '离火', '血爪', '虎魄', '相思', '碧麟'],
        ['石映寒', '降龙', '太玄', '紫啸', '天机', '真朱雀', '赤鬼'],
        ['神秘女侠', '转魄', '太和', '玄阴', '虎魄', '森罗', '碧麟'],
        ['唐雨晨', '千霜', '太和', '玄阴', '虎魄', '森罗', '碧麟'],
      ],
    },
    {
      title: '女拳绝世拳',
      author: '十一',
      rows: [
        ['主', '万躯', '乘风', '血爪', '玄武甲', '凌霄', '白虎'],
        ['胡休', '蛊掌', '离火', '血爪', '虎魄', '妙法', '白虎'],
        ['苏念雪', '达摩剑', '太和', '摘音', '玄武甲', '真凌霄', '白虎'],
        ['林清舞', '追命', '达摩', '紫啸', '真玄武', '真朱雀', '真白虎'],
        ['商昊乾', '关山', '达摩', '青龙', '虎魄', '倾心', '赤鬼'],
        ['顾言', '追风', '玄同', '无锋', '玄武甲', '凤鸣', '赤鬼'],
        ['神秘女侠', '中平', '/', '/', '/', '/', '/'],
        ['唐雨晨', '中平', '/', '/', '/', '凌霄', '碧麟'],
        ['穆云缨', '达摩杖', '太和', '破阵', '虎魄', '森罗', '碧麟'],
      ],
    },
    {
      title: '女拳神兵',
      author: '有人@你',
      rows: [
        ['主', '蛊掌', '斗转', '血爪', '虎魄', '妙法', '白虎'],
        ['苏念雪', '倚天', '金莲', '玄阴', '真玄武', '倾心', '碧麟'],
        ['唐雨晨', '中平', '/', '/', '玄武甲', '/', '/'],
        ['杜月寒', '达摩剑', '镇狱', '玄阴', '虎魄', '相思', '碧麟'],
        ['石映寒', '降龙', '太玄', '紫啸', '鲲鹏', '真朱雀', '赤鬼'],
        ['神秘女侠', '千霜', '太和', '支离', '虎魄', '森罗', '碧麟'],
        ['林清舞', '曜日', '金莲', '血爪', '虎魄', '森罗', '碧麟'],
        ['宗泽', '千山', '离火', '镇龙', '虎魄', '真凌霄', '真白虎'],
        ['芙蓉夏蝉', '转魄', '太和', '玄阴', '虎魄', '朱雀', '碧麟'],
      ],
    },
    {
      title: '女剑绝世刀',
      author: '汤令山',
      rows: [
        ['主', '倚天', '金莲', '玄阴', '真玄武', '倾心', '赤鬼'],
        ['商昊乾', '关山', '达摩', '镇龙', '虎魄', '捕神', '碧麟'],
        ['杜月寒', '转魄', '寂影', '玄阴', '虎魄', '凤鸣', '碧麟'],
        ['唐雨晨', '千霜', '太和', '支离', '虎魄', '相思', '碧麟'],
        ['房若海', '斩天', '镇狱', '镇龙', '虎魄', '真朱雀', '捕神'],
        ['顾言', '达摩剑', '玄同', '无锋', '玄武甲', '倾心', '赤鬼'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '妙法', '白虎'],
        ['林清舞', '无极拳', '纯阳', '紫啸', '虎魄', '森罗', '碧麟'],
        ['神秘女侠', '追风', '太和', '玄阴', '虎魄', '真凌霄', '赤鬼'],
      ],
    },
    {
      title: '女剑绝世内',
      author: '痕恒',
      rows: [
        ['主', '追风', '白兔', '玄阴', '玄武甲', '真朱雀', '白虎'],
        ['顾言', '大同', '玄同', '无锋', '虎魄', '倾心', '赤鬼'],
        ['宗泽', '千山', '太和', '镇龙', '虎魄', '相思', '碧麟'],
        ['穆云缨', '打狗', '太和', '绿玉', '真玄武', '倾心', '碧麟'],
        ['杜月寒', '达摩剑', '太和', '支离', '虎魄', '凌霄', '碧麟'],
        ['苏念雪', '谪仙', '太和', '摘音', '虎魄', '轩辕', '碧麟'],
        ['林清舞', '蛊掌', '离火', '血爪', '虎魄', '真凌霄', '碧麟'],
        ['神秘女侠', '千霜', '太和', '支离', '虎魄', '凌霄', '碧麟'],
        ['唐雨晨', '千霜', '太和', '支离', '虎魄', '凌霄', '碧麟'],
      ],
    },
    {
      title: '女拳绝世剑',
      author: '重铸女拳荣光',
      rows: [
        ['主', '蛊掌', '斗转', '血爪', '玄武甲', '妙法', '白虎'],
        ['杜月寒', '达摩剑', '达摩', '玄阴', '虎魄', '轩辕', '碧麟'],
        ['顾言', '追风', '玄同', '无锋', '玄武袍', '轩辕', '白虎'],
        ['房若海', '关山', '太和', '镇龙', '虎魄', '倾心', '碧麟'],
        ['穆云缨', '打狗', '寂影', '破阵', '虎魄', '倾心', '碧麟'],
        ['芙蓉夏蝉', '无极剑', '纯阳', '支离', '虎魄', '森罗', '碧麟'],
        ['荆枫', '三仙', '达摩', '玄阴', '真玄武', '真朱雀', '真白虎'],
        ['唐雨晨', '谪仙', '太和', '摘音', '虎魄', '森罗', '白虎'],
        ['神秘女侠', '转魄', '太和', '玄阴', '虎魄', '森罗', '赤鬼'],
      ],
    },
    {
      title: '男剑绝世棍',
      author: '玄阴教主 / 顾言宴',
      rows: [
        ['主', '追风', '镇狱', '玄阴', '虎魄', '倾心', '碧麟'],
        ['房若海', '关山', '蔷薇', '镇龙', '虎魄', '凤鸣', '碧麟'],
        ['林清舞', '般若', '易筋', '奔雷', '虎魄', '轩辕', '碧麟'],
        ['蔡半仙', '蛊掌', '离火', '血爪', '虎魄', '相思', '碧麟'],
        ['顾言', '大同', '玄同', '无锋', '千叶', '倾心', '白虎'],
        ['杜月寒', '达摩剑', '太和', '玄阴', '虎魄', '森罗', '碧麟'],
        ['唐雨晨', '中平', '渊海', '/', '玄武袍', '森罗', '碧麟'],
        ['穆云缨', '千钧', '达摩', '破阵', '真玄武', '真朱雀', '赤鬼'],
        ['神秘女侠', '中平', '渊海', '/', '虎魄', '/', '碧麟'],
      ],
    },
  ];

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
          <p class="v03-guide-source-note">已按原图表格确认 ${parsedCount} 组；页面按左侧合并单元格展示，未把标题中的总数当作已核对数量。</p>
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
    if (!guide) return '<p class="v03-guide-empty">专题攻略数据加载中…</p>';
    const hideSource = ['miegu-lineup-summary', 'white-rabbit-martial-rating'].includes(guide.id);
    const sourceNote = hideSource ? '' : `<p class="v03-guide-source-note">来源：${escapeHtml(guide.source?.file || guide.title || '')}</p>`;
    const visibleSections = guide.sections;
    return `<div class="v03-strategy-detail">${sourceNote}${visibleSections.map((section) => {
      if (section.type === 'image') {
        const textSection = guideState.strategyText?.sections?.[section.id];
        return renderStrategyTextSection(section, textSection);
      }
      if (section.type === 'text') return renderStrategyTextSection(section, section);
      if (guide.id === 'longgu-outer-points' && section.id === 'boss-points') return `<section class="v03-strategy-section"><h3>${escapeHtml(section.title)}</h3><div class="v03-longgu-points-grid">${(section.items || []).map((item) => `<article class="v03-longgu-point-card"><header><div><strong>${escapeHtml(item.boss || '未命名 Boss')}</strong><span>${escapeHtml(item.npc || '人物待补')}</span></div><b>${item.points?.length || 0} 个点位</b></header><div class="v03-longgu-point-list">${(item.points || []).map((point, index) => `<span class="v03-longgu-point-chip"><i>${index + 1}</i>${escapeHtml(`${point.value?.x ?? '-'}、${point.value?.y ?? '-'}`)}</span>`).join('')}</div>${item.flags?.length ? `<div class="v03-longgu-point-flags">${item.flags.map((flag) => `<span>${escapeHtml(flag)}</span>`).join('')}</div>` : ''}</article>`).join('')}</div></section>`;
      if (section.type === 'table') return `<section class="v03-strategy-section"><h3>${escapeHtml(section.title)}</h3><div class="v03-guide-table-wrap"><table class="v03-guide-table"><thead><tr>${section.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${(section.items || []).map((item) => `<tr>${strategyCell(item)}</tr>`).join('')}</tbody></table></div></section>`;
      return '';
    }).join('')}</div>`;
  }

  function renderVersionNotes() {
    return `<div class="v03-guide-note-list">${(data.guide_notes || []).map((item) => `<article class="v03-guide-note-card"><span class="v03-guide-note-index">P${escapeHtml(item.page || '-')}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div></article>`).join('')}</div>`;
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
      ? '<p class="v03-guide-empty">更新日志加载中…</p>'
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
    else if (id === 'version-notes') content.innerHTML = renderVersionNotes();
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
        renderFavorites();
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

    document.querySelectorAll('[data-copy-group]').forEach((button) => button.addEventListener('click', () => copyGroupNumber(button)));

    const count = document.getElementById('home-encyclopedia-count');
    if (count) count.textContent = `${data.characters?.length || 0} 位角色 · ${data.martial_arts?.length || 0} 门武学`;
  }

  function loadGuideSources() {
    Promise.all([fetchJson('guide_search_index.json'), fetchJson('strategy_guides.json'), fetchJson('tencent_recipe_data.json'), fetchJson('strategy_ocr_data.json'), fetchJson('update_logs.json')]).then(([searchIndex, strategyGuides, recipeData, strategyText, updateLogs]) => {
      guideState.searchIndex = { ...searchIndex, records: (searchIndex.records || []).filter((item) => item.source === 'original_guide') };
      guideState.strategyGuides = strategyGuides;
      guideState.recipeData = recipeData;
      guideState.strategyText = correctStrategyText(strategyText);
      guideState.updateLogs = updateLogs;
      renderGuideDirectory();
      renderFavorites();
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
  renderFavorites();
  renderAchievements();
  bind();
  loadGuideSources();
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
