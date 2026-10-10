const STORAGE_KEY = 'jianghu-stat-simulator:character:v6';
const ENCYCLOPEDIA_FAVORITES_KEY = 'jianghu-stat-simulator:encyclopedia:favorites:v1';
const WHITE_RABBIT_CACHE_KEY = 'jianghu-stat-simulator:whiterabbit-data:v1';
const REMOTE_WHITE_RABBIT_URLS = [
  'https://jianghu-baitu.oss-cn-beijing.aliyuncs.com/jianghu/whiterabbit_data.json',
  'https://47.95.250.113/jianghu/whiterabbit_data.json',
  'https://flashba.github.io/jianghu-calculator/whiterabbit_data.json',
  'https://cdn.jsdelivr.net/gh/FlashBA/jianghu-calculator@main/web/whiterabbit_data.json',
  'https://raw.githubusercontent.com/FlashBA/jianghu-calculator/main/web/whiterabbit_data.json',
];
const APP_DATA_BASE = window.APP_DATA_BASE || './';
const BASE_SPEED_DEFAULTS_VERSION = 2;
const BASE_CRIT_DEFAULTS_VERSION = 1;
const CHARACTER_BASE_DEFAULTS_VERSION = 1;
const LEGACY_STORAGE_KEYS = [
  'jianghu-stat-simulator:character:v5',
  'jianghu-stat-simulator:character:v4',
  'jianghu-stat-simulator:character:v3',
  'jianghu-stat-simulator:character:v2',
];

const SECONDARY_STAT_DEFS = [
  { key: 'speed', label: '速度', format: 'number', aliases: ['速度'] },
  { key: 'mitigation', label: '免伤', aliases: ['免伤'] },
  { key: 'crit', label: '暴击', aliases: ['暴击率', '暴击'], exclude: '伤害|率' },
  { key: 'dodge', label: '闪避', aliases: ['闪避'] },
  { key: 'lifesteal', label: '吸血', aliases: ['吸血'] },
  { key: 'critDamage', label: '爆伤', aliases: ['暴击伤害', '爆伤'] },
  { key: 'block', label: '格挡', aliases: ['格挡', '招架'] },
  { key: 'reflect', label: '反伤', aliases: ['反伤'] },
  { key: 'recovery', label: '回复', format: 'number', aliases: ['回复', '恢复', '疗伤'] },
];
const SECONDARY_KEYS = SECONDARY_STAT_DEFS.map((stat) => stat.key);
const CHARACTER_BASE_STAT_FIELDS = {
  speed: 'base-speed',
  mitigation: 'base-mitigation',
  crit: 'base-crit',
  dodge: 'base-dodge',
  lifesteal: 'base-lifesteal',
  critDamage: 'base-crit-damage',
  block: 'base-block',
  reflect: 'base-reflect',
  recovery: 'base-recovery',
};
const DEFAULT_CHARACTER_BASE_STATS = {
  speed: 0,
  mitigation: 0,
  crit: 10,
  dodge: 0,
  lifesteal: 0,
  critDamage: 0,
  block: 0,
  reflect: 0,
  recovery: 0,
};
const MAX_COMPARISON_SNAPSHOTS = 300;
const MAX_CARD_NAME_LENGTH = 20;
const MAX_TEAM_NAME_LENGTH = 20;
const MAX_TEAMS = 100;
const MAX_TEAM_SLOTS = 9;
const INNER_MANUAL_FIELD_IDS = ['neigong-hp', 'neigong-attack', ...SECONDARY_KEYS.map((key) => (
  `neigong-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
))];
const WEAPON_ATTRIBUTE_OPTIONS = [
  { key: 'hp', label: '生命' },
  { key: 'attack', label: '武器白值攻击' },
  ...SECONDARY_STAT_DEFS.map((stat) => ({ key: stat.key, label: stat.label })),
];
const FORMATION_OPTIONS = [
  { key: '', label: '不布阵' },
  { key: 'jiugong', label: '九宫八卦阵' },
  { key: 'baxu', label: '八枢汇极阵' },
];
const FORMATION_POSITION_OPTIONS = Array.from({ length: 9 }, (_, index) => ({
  key: String(index + 1),
  label: `${index + 1}号位`,
}));
const MARTIAL_STYLE_KEYS = ['拳法', '剑法', '刀法', '棍法'];
const CALCULATION_DOCUMENT = [
  {
    title: '基础数值',
    formulas: [
      '基础生命 = trunc(等级生命表[等级] × 生命系数)',
      '基础攻击 = 等级攻击表[等级] × 攻击系数',
    ],
    notes: ['百分比计算使用基础攻击原值，面板展示时再截断为整数。'],
  },
  {
    title: '生命',
    formulas: [
      '血丹乘区 = 1 + 血丹数量 × 2%',
      '血丹后生命 = 血丹后基础生命 × (1 + 内功生命% + 技艺生命% + 装备生命% + 武器生命% + 小任督生命%)',
      '阵法生命乘区 = 1 + 阵法生命加成%（八枢 1 号位为 ×1.24，其他位置为 ×0.93）',
      '内功大任督生命 = 基础生命 × (110% + 补充生命%)',
      '最终生命 = round((round(血丹后生命 + 内功大任督生命) + 成就固定生命 + 装备/武器白值生命) × 阵法生命乘区)',
    ],
    notes: ['血丹最多按 30 颗计算。内功大任督按血丹前基础生命计算，不吃装备白值和成就固定值。'],
  },
  {
    title: '任督',
    formulas: [
      '小任督生命% = min(未装备九重内功品阶贡献之和, 20%)',
      '小任督攻击% = min(未装备九重武学品阶贡献之和, 10%)',
      '内功大任督攻击 = 基础攻击 × (100% + 补充攻击%)',
      '武学大任督乘区 = 1 + 九重 S 武学数量 × 5%',
    ],
    notes: ['小任督只统计九重且未装备的项目；武学大任督按已学九重 S 武学数量计算，默认数量为 5。'],
  },
  {
    title: '攻击',
    formulas: [
      '基础攻击项 = B × 攻击丹乘区 × (1 + 内功攻击% + 技艺攻击% + 武学威力加成%)',
      '武学项 = P × (1 + 内功攻击% + 小任督攻击% + 技艺攻击% + 武学威力加成%)',
      '武学威力加成 = 普通威力加成 + 当前武学对应的满级佛法/道学加成',
      '阵法攻击乘区 = 1 + 阵法攻击加成%（八枢 1 号位为 ×1.24，其他位置为 ×0.93）',
      '内功大任督攻击项 = B × (10% × 大任督数量 + 补充攻击%)',
      '装备百分比项 = (B × 攻击丹乘区 + P) × (装备攻击% + 武器铸造攻击%)',
      '阵法前攻击 = trunc((基础攻击项 + 武学项 + 大任督攻击项 + 装备百分比项 + 固定攻击) × 武学大任督乘区) + 成就固定攻击',
      '最终攻击 = trunc(trunc(阵法前攻击 × 后宫乘区) × 阵法攻击乘区)',
    ],
    notes: ['B 为基础攻击原值，P 为当前武学原始威力。朱雀之力等生效技艺攻击%同时进入基础攻击项和武学项；小任督攻击%只进入武学项。'],
  },
  {
    title: '面板属性与回复',
    formulas: [
      '速度 = 初始速度 + 武学速度 + 速度丹 + 内功大任督速度',
      '其他面板属性 = 基础属性 + 内功属性 + 技艺属性 + 阵法属性 + 装备属性 + 武器属性',
      '回复基础生命 = 基础生命 × (1 + 内功生命%)',
      '最终回复 = trunc(回复基础生命 × 回复% + 回复基础生命 × 技艺回复基础生命%)',
    ],
    notes: ['主角初始速度为 0，其他角色默认 10；速度丹默认 +30，内功大任督默认 +8。玄武类回复使用乘以内功生命加成后的基础生命。'],
  },
  {
    title: '伤害结算',
    formulas: [
      '原版浮动倍率 = (随机整数 90～110) ÷ 100',
      '本次伤害基数 = 最终攻击 + 本次必定触发的人物基础附伤 + 武器白值附伤',
      '理论上限伤害基数 = 最终攻击 + 已知附伤全部触发时的人物基础附伤 + 武器白值附伤',
      '人物基础附伤 = 基础攻击原值 B × 人物基础攻击附伤%；武器白值附伤 = 当前强化武器白值攻击 × 武器攻击附伤%；其他附伤按明确标注的最终攻击/最终生命取值',
      '概率附伤按触发时加入，周期附伤只在对应回合加入',
      '普通伤害浮动 = trunc(本次伤害基数 × 伤害系数 × 90%～110% × (1 - min(对方免伤, 50%)))',
      '默认理论爆伤% = 武学爆伤倍率 × 100 + 面板爆伤%；可在理论伤害中手动覆盖',
      '最终暴击倍率 = 理论伤害爆伤值 ÷ 100',
      '暴击伤害浮动 = trunc(本次伤害基数 × 伤害系数 × 90%～110% × 最终暴击倍率 × (1 - min(对方免伤, 50%)))',
      '多段武学伤害 = 各段分别按对应爆伤倍率计算后求和；多段概率按已知的二连/三连触发概率展示',
      '结算后附伤 = 按武学触发条件，将已完成免伤计算的伤害乘以后置附伤倍率',
      '天狼破穹枪触发概率 = 暴击率 × 30%；触发时暴击伤害再 × 1.5',
      '阵法独立伤害乘区 = 1 + 阵法独立伤害%',
      '最终伤害 = 结算后附伤 × 阵法独立伤害乘区',
      '理论伤害上限 = max(普通伤害上限, 暴击伤害上限)',
      '理论上限概率 = 暴击率 × 多段上限概率 × 概率附伤触发率（无多段数据时取 1；周期附伤按对应回合判断）',
      '白兔追命拳理论期望段数 = 各段到达概率之和；追加出手暴击率每段衰减 30%，下一段到达概率低于 3% 后停止',
      '实际伤害 = trunc(浮动伤害 × (1 - min(目标免伤, 50%)))',
    ],
    notes: ['人物基础附伤只取基础攻击原值 B；武器白值附伤只取武器编辑器中的当前强化最终白值，百分比攻击词条不作为白值。理论上限概率使用最终面板暴击率，并把已知概率/周期附伤视为触发态，但不会把它们当作每次出手必定生效。随1/随2/随3/邻2/邻3是目标范围，不自动套用统一分摊系数。'],
  },
];

const EMPTY_EQUIPMENT = () => ({
  id: null, name: '', hp: 0, attack: 0, hpFlat: 0, attackFlat: 0,
  secondary: emptySecondaryStats(), extra: '',
});
const EMPTY_WEAPON_AFFIX = () => ({ key: '', mode: 'flat', value: 0 });
const state = {
  data: null,
  whiteRabbit: null,
  equipmentSlots: [EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT()],
  weaponId: '',
  weaponName: '',
  weaponMode: 'empty',
  weaponForgeOption: '',
  weaponAffixes: [EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX()],
};
let calculatorInitialized = false;
let calculatorEventsBound = false;
let startupPending = null;
let startupBaseData = null;
let startupError = '';
let resultGenerated = false;
let currentResult = null;
let comparisonSnapshots = [];
let comparisonPair = [0, 1];
let activeComparisonIndex = null;
let comparisonExpanded = false;
let techniqueSelectionCustomized = false;
let teams = [];
let activeView = 'calculator';
let pendingNameDialog = null;
let pendingTeamPicker = null;
let pendingConfirmation = null;
let expandedTeamId = null;
let damageFactorCustomized = false;
let damageCritCustomized = false;
let haremBonusCustomized = false;
let characterStyleFilter = '';
let characterSort = 'total';
let characterSortDirection = 'desc';
let martialSort = 'power';
let martialSortDirection = 'desc';
let innerSort = 'mitigation';
let innerSortDirection = 'desc';
let encyclopediaFavorites = readEncyclopediaFavorites();

const HAREM_EXCLUDED_MARTIALS = new Set(['白兔三仙剑', '白兔追命拳', '白兔斩天刀', '白兔千钧棍']);

function readEncyclopediaFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(ENCYCLOPEDIA_FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveEncyclopediaFavorites() {
  localStorage.setItem(ENCYCLOPEDIA_FAVORITES_KEY, JSON.stringify([...encyclopediaFavorites]));
  window.dispatchEvent(new CustomEvent('jianghu-encyclopedia-favorites-changed', {
    detail: { favorites: [...encyclopediaFavorites] },
  }));
}

function toggleEncyclopediaFavorite(id) {
  if (encyclopediaFavorites.has(id)) {
    encyclopediaFavorites.delete(id);
  } else {
    encyclopediaFavorites.add(id);
    if (id.startsWith('characters:')) encyclopediaFavorites.delete(id.slice('characters:'.length));
  }
  saveEncyclopediaFavorites();
}

function whiteRabbitDataValid(data) {
  return Boolean(data
    && Array.isArray(data.characters)
    && Array.isArray(data.techniques)
    && Array.isArray(data.inner_skills)
    && Array.isArray(data.martial_arts)
    && Array.isArray(data.equipment)
    && Array.isArray(data.dungeon_drops));
}

function whiteRabbitVersionParts(data) {
  return String(data?.version || '0')
    .split(/[^\d]+/)
    .filter(Boolean)
    .map((part) => Number(part) || 0);
}

function compareWhiteRabbitVersion(left, right) {
  const leftParts = whiteRabbitVersionParts(left);
  const rightParts = whiteRabbitVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff) return diff;
  }
  return 0;
}

function whiteRabbitDataTimestamp(data) {
  const candidates = [
    data?.source?.dungeon_drops?.synced_at,
    data?.source?.synced_at,
    data?.updated_at,
    data?.updatedAt,
  ];
  return candidates.reduce((latest, value) => {
    const timestamp = Date.parse(String(value || ''));
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);
}

function compareWhiteRabbitData(left, right) {
  const versionDiff = compareWhiteRabbitVersion(left, right);
  if (versionDiff) return versionDiff;
  const leftTimestamp = whiteRabbitDataTimestamp(left);
  const rightTimestamp = whiteRabbitDataTimestamp(right);
  if (leftTimestamp !== rightTimestamp) {
    if (!leftTimestamp) return -1;
    if (!rightTimestamp) return 1;
    return leftTimestamp - rightTimestamp;
  }
  const leftDropCount = Array.isArray(left?.dungeon_drops) ? left.dungeon_drops.length : 0;
  const rightDropCount = Array.isArray(right?.dungeon_drops) ? right.dungeon_drops.length : 0;
  return leftDropCount - rightDropCount;
}

function whiteRabbitSignature(data) {
  if (!whiteRabbitDataValid(data)) return '';
  return [
    data.version || '',
    data.characters.length,
    data.techniques.length,
    data.inner_skills.length,
    data.martial_arts.length,
    data.equipment.length,
    data.dungeon_drops.length,
    JSON.stringify(data.source || {}),
  ].join('|');
}

function chooseWhiteRabbitData(primary, fallback) {
  if (!whiteRabbitDataValid(primary)) return whiteRabbitDataValid(fallback) ? fallback : null;
  if (!whiteRabbitDataValid(fallback)) return primary;
  return compareWhiteRabbitData(primary, fallback) >= 0 ? primary : fallback;
}

function readCachedWhiteRabbitData() {
  try {
    const cache = JSON.parse(localStorage.getItem(WHITE_RABBIT_CACHE_KEY) || 'null');
    return whiteRabbitDataValid(cache?.data) ? cache.data : null;
  } catch {
    return null;
  }
}

function saveCachedWhiteRabbitData(data) {
  if (!whiteRabbitDataValid(data)) return;
  try {
    localStorage.setItem(WHITE_RABBIT_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      version: data.version || '',
      data,
    }));
  } catch {
    // Storage may be unavailable in a restricted WebView; bundled data remains usable.
  }
}

const $ = (id) => document.getElementById(id);

function trunc(value) { return Math.trunc(value); }
function formatNumber(value) { return Number(value).toLocaleString('zh-CN'); }
function localId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function characterCardCount(roleName, cards = comparisonSnapshots, excludeIndex = -1) {
  return cards.filter((card, index) => index !== excludeIndex && card?.roleName === roleName).length;
}
function defaultCardName(roleName, cards = comparisonSnapshots, excludeIndex = -1) {
  const sequence = characterCardCount(roleName, cards, excludeIndex) + 1;
  return `${roleName}${String(sequence).padStart(3, '0')}`.slice(0, MAX_CARD_NAME_LENGTH);
}
function defaultTeamName() {
  return `配队${String(teams.length + 1).padStart(3, '0')}`.slice(0, MAX_TEAM_NAME_LENGTH);
}
function normalizedName(value) {
  return Array.from(String(value || '').trim()).slice(0, MAX_CARD_NAME_LENGTH).join('');
}
function isDuplicateCardName(name, excludeIndex = -1) {
  const normalized = name.toLocaleLowerCase();
  return comparisonSnapshots.some((card, index) => index !== excludeIndex
    && String(card.name || '').trim().toLocaleLowerCase() === normalized);
}
function formatPercent(value) {
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}
function numberValue(id, fallback = 0) {
  const value = Number($(id).value);
  return Number.isFinite(value) ? value : fallback;
}
function numberValueFrom(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
function emptySecondaryStats() {
  return Object.fromEntries(SECONDARY_KEYS.map((key) => [key, 0]));
}
function emptyStylePower() {
  return Object.fromEntries(MARTIAL_STYLE_KEYS.map((style) => [style, 0]));
}
function addStylePower(target, source) {
  MARTIAL_STYLE_KEYS.forEach((style) => { target[style] += numberValueFrom(source?.[style]); });
  return target;
}
function stylePowerFromText(text) {
  const totals = emptyStylePower();
  const normalized = String(text || '').replaceAll('\n', '，');
  const beforeStyle = /(\d+(?:\.\d+)?)\s*%{1,2}[^\n，。；;]*?(拳脚|拳掌|拳法|剑法|刀法|棍法)[^\n，。；;]*?(?:威力|伤害)/g;
  const afterStyle = /(拳脚|拳掌|拳法|剑法|刀法|棍法)[^\n，。；;]*?(\d+(?:\.\d+)?)\s*%{1,2}[^\n，。；;]*?(?:威力|伤害)/g;
  let match;
  while ((match = beforeStyle.exec(normalized))) {
    const style = match[2] === '拳脚' || match[2] === '拳掌' ? '拳法' : match[2];
    totals[style] += Number(match[1]);
  }
  while ((match = afterStyle.exec(normalized))) {
    const style = match[1] === '拳脚' || match[1] === '拳掌' ? '拳法' : match[1];
    totals[style] += Number(match[2]);
  }
  return totals;
}
function stylePowerFromEffect(effect) {
  const text = String(effect?.desp || '');
  const rendered = Number.isFinite(Number(effect?.v)) && /%d/.test(text)
    ? text.replaceAll('%d', String(effect.v))
    : text;
  return stylePowerFromText(rendered);
}
function martialRuleName(item) {
  return String(item?.name || item?.nick || '').trim();
}
function nativeMartialItem(item) {
  if (item?.levelEffect) return item;
  const target = normalizedDataName(martialRuleName(item));
  if (!target) return null;
  return Object.values(state.data?.skill || {}).find((candidate) => (
    normalizedDataName(candidate?.nick || candidate?.name) === target
  )) || null;
}
function nativeMartialRule(item) {
  const levelEffect = nativeMartialItem(item)?.levelEffect;
  const parameter = Number(levelEffect?.param);
  const value = Number(levelEffect?.v);
  if (![7018, 7207].includes(parameter) || !Number.isFinite(value) || value <= 0) return null;
  return {
    technique: parameter === 7018 ? '佛法' : '道学',
    maxPercent: value / 100,
    source: '原版 5.40 levelEffect',
  };
}
function nativeMartialDamageEffects(item) {
  const levelEffect = nativeMartialItem(item)?.levelEffect;
  const type = Number(levelEffect?.t);
  const value = Number(levelEffect?.v);
  if (![134217734, 134217735].includes(type) || !Number.isFinite(value) || value <= 0) return [];
  return [{
    source: type === 134217734 ? 'weapon_attack' : 'base_attack',
    percent: value / 100,
    chance_percent: Number(levelEffect?.rate) || 100,
    period_rounds: Number(levelEffect?.r) > 0 ? Number(levelEffect.r) + 1 : 0,
  }];
}
function martialRule(item) {
  const name = martialRuleName(item);
  const stored = state.whiteRabbit?.martial_rules?.[name] || {};
  const native = nativeMartialRule(item) || {};
  return {
    ...native,
    ...stored,
    damageEffects: stored.damage_effects || stored.damageEffects || nativeMartialDamageEffects(item),
  };
}
function selectedTechniqueMaxLevel(name) {
  const normalized = String(name || '').replace(/禅理$/, '');
  const technique = selectedTechniques().find((item) => {
    const candidate = String(item?.name || '');
    return techniqueScopeStatus(item) && (candidate === name || candidate.startsWith(normalized));
  });
  return Number(technique?.max_level) || 0;
}
function martialTechniqueBonusPercent(item) {
  const rule = martialRule(item);
  const maxPercent = Number(rule.max_percent ?? rule.maxPercent);
  if (!rule.technique || !Number.isFinite(maxPercent) || maxPercent <= 0) return 0;
  const level = selectedTechniqueMaxLevel(rule.technique);
  const maxLevel = Math.max(1, selectedTechniqueMaxLevel(rule.technique) || 300);
  return Number((maxPercent * Math.min(1, level / maxLevel)).toFixed(2));
}
function martialDamageEffects(item) {
  return martialRule(item).damageEffects
    .map((effect) => ({
      source: effect.source,
      percent: Number(effect.percent) || 0,
      chancePercent: Number(effect.chance_percent ?? effect.chancePercent) || 100,
      periodRounds: Number(effect.period_rounds ?? effect.periodRounds) || 0,
    }))
    .filter((effect) => ['base_attack', 'weapon_attack', 'final_attack', 'max_hp'].includes(effect.source)
      && effect.percent > 0);
}
function damageAttachmentTotals(effects, { baseAttackRaw, weaponWhiteAttack, finalAttack, maxHp }) {
  return effects.reduce((totals, effect) => {
    const sourceValue = {
      base_attack: baseAttackRaw,
      weapon_attack: weaponWhiteAttack,
      final_attack: finalAttack,
      max_hp: maxHp,
    }[effect.source];
    const amount = sourceValue * effect.percent / 100;
    if (Object.prototype.hasOwnProperty.call(totals, effect.source)) {
      totals[effect.source] += Number.isFinite(amount) ? amount : 0;
    }
    return totals;
  }, { base_attack: 0, weapon_attack: 0, final_attack: 0, max_hp: 0 });
}
function guaranteedDamageEffects(effects) {
  return effects.filter((effect) => effect.chancePercent >= 100 && effect.periodRounds <= 0);
}
function addSecondaryStats(target, source) {
  SECONDARY_KEYS.forEach((key) => { target[key] += numberValueFrom(source?.[key]); });
  return target;
}
function secondaryStatsFromRecord(record) {
  return {
    speed: Number(record?.speed) || 0,
    mitigation: Number(record?.mitigation_percent) || 0,
    crit: Number(record?.crit_percent) || 0,
    dodge: Number(record?.dodge_percent) || 0,
    lifesteal: Number(record?.lifesteal_percent) || 0,
    critDamage: Number(record?.crit_damage_percent) || 0,
    block: Number(record?.block) || 0,
    reflect: Number(record?.reflect_percent) || 0,
    recovery: Number(record?.heal_percent) || 0,
  };
}
function formatSecondaryValue(key, value) {
  return SECONDARY_STAT_DEFS.find((stat) => stat.key === key)?.format === 'number'
    ? formatNumber(Math.round(Number(value) || 0))
    : formatPercent(value);
}
function secondaryStatsFromText(text) {
  const stats = emptySecondaryStats();
  const statMap = {
    速度: 'speed', 免伤: 'mitigation', 闪避: 'dodge', 吸血: 'lifesteal',
    暴击率: 'crit', 暴击: 'crit', 暴击伤害: 'critDamage', 爆伤: 'critDamage',
    格挡: 'block', 招架: 'block', 反伤: 'reflect', 回复: 'recovery',
    恢复: 'recovery', 疗伤: 'recovery',
  };
  const normalized = String(text || '');
  const pattern = /(降低|减少)?\s*(\d+(?:\.\d+)?)\s*%?\s*(暴击伤害|爆伤|暴击率|暴击|免伤|闪避|吸血|反伤|格挡|招架|回复|恢复|疗伤|速度)/g;
  let match;
  while ((match = pattern.exec(normalized))) {
    const key = statMap[match[3]];
    if (!key) continue;
    const clauseStart = Math.max(
      normalized.lastIndexOf('。', match.index),
      normalized.lastIndexOf('；', match.index),
      normalized.lastIndexOf(';', match.index),
      normalized.lastIndexOf('\n', match.index),
    ) + 1;
    const operator = normalized.slice(clauseStart, match.index).match(/降低|减少|增加|提高|提升/g)?.at(-1);
    const sign = operator === '降低' || operator === '减少' || match[1] ? -1 : 1;
    stats[key] += sign * Number(match[2]);
  }
  return stats;
}
function secondaryStatsSummary(stats) {
  return SECONDARY_STAT_DEFS
    .map((definition) => {
      const value = Number(stats?.[definition.key]) || 0;
      const formatted = definition.key === 'recovery'
        ? formatPercent(value)
        : formatSecondaryValue(definition.key, value);
      return value ? formatted + definition.label : '';
    })
    .filter(Boolean)
    .join(' · ');
}
function innerStatsSummary(stats) {
  if (!stats) return '无属性';
  const primary = [
    stats.hp ? `${formatPercent(stats.hp)}血` : '',
    stats.attack ? `${formatPercent(stats.attack)}攻` : '',
  ].filter(Boolean);
  const secondary = secondaryStatsSummary(stats.secondary);
  if (secondary) primary.push(secondary);
  return primary.join(' / ') || '无属性';
}
function formationStats() {
  const formation = $('formation-select')?.value || '';
  if (!formation) return { name: '不布阵', position: 0, hp: 0, attack: 0, damage: 0, secondary: emptySecondaryStats(), note: '' };
  const roleName = $('person-name').value.trim() || '自定义角色';
  const position = roleName === '主角'
    ? 1
    : Math.max(2, Math.min(9, Math.round(numberValue('formation-position', 2))));
  const secondary = emptySecondaryStats();
  const result = {
    name: formation === 'jiugong' ? '九宫八卦阵' : '八枢汇极阵',
    position,
    hp: 0,
    attack: 0,
    damage: 0,
    secondary,
    note: '',
  };
  if (formation === 'jiugong') {
    const slots = {
      1: { hp: -20, attack: -20, mitigation: -12, note: '中宫，负责维持阵法' },
      2: { lifesteal: 10, dodge: 12, note: '坎位' },
      3: { hp: 10, mitigation: 5, note: '坤位' },
      4: { speed: 15, crit: 8, note: '震位' },
      5: { speed: 12, dodge: 12, note: '巽位' },
      6: { damage: 20, note: '乾位，独立伤害乘区' },
      7: { crit: 10, lifesteal: 10, note: '兑位' },
      8: { block: 15, reflect: 50, note: '艮位' },
      9: { crit: 10, critDamage: 50, note: '离位' },
    };
    const slot = slots[position];
    result.hp = slot.hp || 0;
    result.attack = slot.attack || 0;
    result.damage = slot.damage || 0;
    addSecondaryStats(secondary, slot);
    result.note = slot.note;
    return result;
  }
  if (position === 1) {
    const scale = 1;
    result.hp = 24 * scale;
    result.attack = 24 * scale;
    addSecondaryStats(secondary, {
      lifesteal: 24 * scale,
      crit: 24 * scale,
      critDamage: 48 * scale,
      speed: 24 * scale,
      mitigation: 24 * scale,
      dodge: 24 * scale,
      block: 24 * scale,
    });
    result.note = '1号位初始效果 100%';
  } else {
    result.hp = -7;
    result.attack = -7;
    addSecondaryStats(secondary, {
      mitigation: -7,
      speed: -7,
      dodge: -7,
      block: -7,
      crit: -7,
      critDamage: -14,
      lifesteal: -7,
    });
    result.note = '2-9号位负面效果';
  }
  return result;
}
const WEAPON_TYPES = new Set([1, 2, 3, 4]);
function isWeapon(item) {
  return item?.weapon === true
    || String(item?.slot || '').startsWith('weapon-')
    || WEAPON_TYPES.has(Number(item?.type));
}
function isSEquipment(item) {
  return item?.source === 'white'
    ? isSOrUnknownRank(item.rank)
    : Number(item?.star) >= 6;
}
function isSOrUnknownRank(value) {
  const rank = String(value || '').trim().toUpperCase();
  return rank.endsWith('S') || rank === '?' || rank === '？';
}
function displayMartialRank(value) {
  const rank = String(value || '').trim().replaceAll('？', '?').toUpperCase();
  return /^\d+S$/.test(rank) ? 'S' : rank || '品级待补';
}
function martialCritDamageLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '/') return '';
  if (raw.includes('/')) return `爆伤 ×${raw}`;
  const number = Number(raw);
  return Number.isFinite(number) ? `爆伤 ×${number.toFixed(2)}` : `爆伤 ×${raw}`;
}
function getWhiteEquipment(id) {
  return state.whiteRabbit?.equipment?.find((item) => String(item.id) === String(id));
}
function normalizedDataName(value) {
  return String(value || '').replace(/\s+/g, '');
}
function findWhiteEquipmentByName(name) {
  const target = normalizedDataName(name);
  if (!target) return null;
  return state.whiteRabbit?.equipment?.find((item) => normalizedDataName(item.name || item.nick) === target) || null;
}
function findWhiteInnerIndexByName(name) {
  const target = normalizedDataName(name);
  return (state.whiteRabbit?.inner_skills || []).findIndex((item) => normalizedDataName(item.name) === target);
}
function findWhiteMartialIndexByName(name) {
  const target = normalizedDataName(name);
  return (state.whiteRabbit?.martial_arts || []).findIndex((item) => normalizedDataName(item.name) === target);
}
function getRawEquipment(id) {
  const key = String(id);
  return key.startsWith('wr-eq-') ? getWhiteEquipment(key) : state.data?.equip?.[key];
}
function getEquipment(id) {
  const item = getRawEquipment(id);
  return isWeapon(item) || !isSEquipment(item) ? null : item;
}
function getWhiteInner(index) {
  const item = state.whiteRabbit?.inner_skills?.[Number(index)];
  return item || null;
}
function getSelectedMartial() {
  const value = $('martial-select')?.value || '';
  if (!value) return null;
  if (value.startsWith('old-skill:')) {
    const item = state.data?.skill?.[value.slice(10)];
    return item ? { source: 'game', item } : null;
  }
  if (value.startsWith('wr-skill:')) {
    const item = state.whiteRabbit?.martial_arts?.[Number(value.slice(9))];
    return item ? { source: 'white', item } : null;
  }
  return null;
}
function martialCriticalMultiplier(item) {
  return Math.max(...martialCriticalMultipliers(item));
}
function martialCriticalMultipliers(item) {
  const values = String(item?.crit_damage ?? item?.baojiEffect ?? '')
    .split('/')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? values : [1.25];
}
function martialDamageFactor(item) {
  const value = Number(item?.damage_factor);
  return Number.isFinite(value) && value >= 0 ? value : 1;
}
function martialPostDamageRule(item) {
  const value = Number(item?.post_damage_multiplier);
  const multiplier = Number.isFinite(value) && value >= 0 ? value : 1;
  const trigger = String(item?.post_damage_trigger || 'always').trim().toLowerCase();
  const defaultChance = trigger === 'always' ? 100 : 0;
  const chanceValue = Number(item?.post_damage_chance_percent);
  const chancePercent = Number.isFinite(chanceValue)
    ? Math.max(0, Math.min(100, chanceValue))
    : defaultChance;
  return { multiplier, trigger, chancePercent };
}
function martialPostDamageMultiplier(item) {
  return martialPostDamageRule(item).multiplier;
}
function martialComboHitModel(item, totalCritPercent = Number(item?.crit_percent) || 0) {
  const config = item?.combo_on_crit;
  if (!config || typeof config !== 'object') return null;
  const baseCritValue = Number(config.crit_percent ?? totalCritPercent);
  const baseCritChance = Math.max(0, Math.min(100, Number.isFinite(baseCritValue) ? baseCritValue : 0)) / 100;
  const decayValue = Number(config.crit_decay_percent);
  const decayMultiplier = 1 - Math.max(0, Math.min(100, Number.isFinite(decayValue) ? decayValue : 0)) / 100;
  const thresholdValue = Number(config.min_next_probability_percent);
  const threshold = Math.max(0, Math.min(100, Number.isFinite(thresholdValue) ? thresholdValue : 3)) / 100;
  const reaches = [1];
  const critChances = [baseCritChance];
  let reach = 1;
  let nextCritChance = baseCritChance;
  while (reach * nextCritChance >= threshold && nextCritChance > 0) {
    const nextSegmentProbability = reach * nextCritChance;
    reach = nextSegmentProbability;
    reaches.push(reach);
    nextCritChance *= decayMultiplier;
    critChances.push(nextCritChance);
  }
  const profiles = reaches.map((reachProbability, index) => ({
    segments: index + 1,
    reachProbabilityRaw: reachProbability,
    reachProbability: Number((reachProbability * 100).toFixed(4)),
    probability: Number(((reachProbability - (reaches[index + 1] || 0)) * 100).toFixed(4)),
    critProbabilityRaw: critChances[index],
    critProbability: Number((critChances[index] * 100).toFixed(4)),
  }));
  return {
    combo: true,
    profiles,
    expectedSegments: reaches.reduce((sum, value) => sum + value, 0),
    decayPercent: (1 - decayMultiplier) * 100,
    thresholdPercent: threshold * 100,
  };
}
function standardHitModel(item) {
  const probabilityMap = Object.fromEntries(Object.entries(item?.multi_hit_probabilities || {})
    .map(([segments, probability]) => [Number(segments), Math.max(0, Math.min(100, Number(probability) || 0))])
    .filter(([segments, probability]) => Number.isFinite(segments) && segments > 1 && Number.isFinite(probability)));
  const probabilitySegments = Object.keys(probabilityMap).map(Number);
  if (!probabilitySegments.length) {
    return {
      combo: false,
      profiles: [{ segments: 1, probability: 100, probabilityRaw: 1, reachProbability: 100, reachProbabilityRaw: 1 }],
      expectedSegments: 1,
    };
  }
  const maxSegments = Math.max(1, Number(item?.segments) || 0, ...probabilitySegments);
  const profiles = Array.from({ length: maxSegments }, (_, index) => {
    const segments = index + 1;
    const reachProbability = segments === 1 ? 100 : probabilityMap[segments] || 0;
    const nextReachProbability = segments < maxSegments ? (probabilityMap[segments + 1] || 0) : 0;
    return {
      segments,
      reachProbabilityRaw: reachProbability / 100,
      reachProbability,
      probability: Number((Math.max(0, reachProbability - nextReachProbability)).toFixed(2)),
      probabilityRaw: Math.max(0, reachProbability - nextReachProbability) / 100,
    };
  });
  return {
    combo: false,
    profiles,
    expectedSegments: profiles.reduce((sum, profile) => sum + profile.reachProbability / 100, 0),
  };
}
function martialHitModel(item, totalCritPercent = Number(item?.crit_percent) || 0) {
  return martialComboHitModel(item, totalCritPercent) || standardHitModel(item);
}
function martialHitProfiles(item, totalCritPercent = Number(item?.crit_percent) || 0) {
  return martialHitModel(item, totalCritPercent).profiles;
}
function martialHitProbabilityLabel(item, totalCritPercent = Number(item?.crit_percent) || 0) {
  const profiles = martialHitProfiles(item, totalCritPercent);
  if (profiles.length <= 1) return '';
  return profiles.map((profile) => profile.segments === 1
    ? '1段'
    : `${profile.segments}段${formatPercent(profile.reachProbability)}`).join(' / ');
}
function damageUpperLimitProbability(item, totalCritPercent = Number(item?.crit_percent) || 0) {
  const critPercent = Math.max(0, Math.min(100, Number(totalCritPercent) || 0));
  const model = martialHitModel(item, critPercent);
  const maxProfile = model.profiles[model.profiles.length - 1];
  let probability = maxProfile?.reachProbabilityRaw ?? ((maxProfile?.reachProbability || 0) / 100);
  if (model.combo) {
    probability *= maxProfile?.critProbabilityRaw ?? ((maxProfile?.critProbability || 0) / 100);
  } else {
    probability *= critPercent / 100;
  }
  const postRule = martialPostDamageRule(item);
  if (postRule.trigger === 'crit') probability *= postRule.chancePercent / 100;
  martialDamageEffects(item).forEach((effect) => {
    if (effect.periodRounds <= 0 && effect.chancePercent < 100) {
      probability *= effect.chancePercent / 100;
    }
  });
  return Number((probability * 100).toFixed(2));
}
function martialRange(item) {
  if (item?.range) return String(item.range);
  return ({ 21: '随1', 22: '随2', 23: '随3', 24: '邻2', 25: '邻3' })[Number(item?.mode)] || '单体范围待补';
}
function calculateDamagePreview({ attack, baseAttackRaw, weaponWhiteAttack, maxHp, martial, stats, damageFactor, targetMitigation, critDamageValue = null, formationDamagePercent = 0, haremAttackMultiplier = 1 }) {
  if (!martial) return null;
  const attackValue = Math.max(0, Number(attack) || 0);
  const factor = Math.max(0, Number(damageFactor) || 0);
  const mitigation = Math.max(0, Math.min(50, Number(targetMitigation) || 0));
  const damageEffects = martialDamageEffects(martial);
  const guaranteedEffects = guaranteedDamageEffects(damageEffects);
  const attachmentInputs = { baseAttackRaw, weaponWhiteAttack, finalAttack: attackValue, maxHp };
  const attachmentTotals = damageAttachmentTotals(guaranteedEffects, attachmentInputs);
  const maxAttachmentTotals = damageAttachmentTotals(damageEffects, attachmentInputs);
  const expectedAttachmentTotals = damageEffects.reduce((totals, effect) => {
    if (effect.periodRounds > 0) return totals;
    const chance = Math.max(0, Math.min(100, effect.chancePercent)) / 100;
    const sourceValue = {
      base_attack: baseAttackRaw,
      weapon_attack: weaponWhiteAttack,
      final_attack: attackValue,
      max_hp: maxHp,
    }[effect.source];
    const amount = sourceValue * effect.percent / 100 * chance;
    if (Object.prototype.hasOwnProperty.call(totals, effect.source)) {
      totals[effect.source] += Number.isFinite(amount) ? amount : 0;
    }
    return totals;
  }, { base_attack: 0, weapon_attack: 0, final_attack: 0, max_hp: 0 });
  const attachmentDamage = Object.values(attachmentTotals).reduce((sum, value) => sum + value, 0);
  const maxAttachmentDamage = Object.values(maxAttachmentTotals).reduce((sum, value) => sum + value, 0);
  const expectedAttachmentDamage = Object.values(expectedAttachmentTotals).reduce((sum, value) => sum + value, 0);
  const effectiveAttack = (attackValue + attachmentDamage) * factor * (1 - mitigation / 100);
  const maxEffectiveAttack = (attackValue + maxAttachmentDamage) * factor * (1 - mitigation / 100);
  const expectedEffectiveAttack = (attackValue + expectedAttachmentDamage) * factor * (1 - mitigation / 100);
  const postDamageRule = martialPostDamageRule(martial);
  const postDamageMultiplier = postDamageRule.multiplier;
  const alwaysPostDamageMultiplier = postDamageRule.trigger === 'always' ? postDamageMultiplier : 1;
  const formationDamageMultiplier = 1 + Math.max(0, Number(formationDamagePercent) || 0) / 100;
  const finalDamageMultiplier = alwaysPostDamageMultiplier * formationDamageMultiplier;
  const criticalMultipliers = martialCriticalMultipliers(martial);
  const baseCritMultiplier = Math.max(...criticalMultipliers);
  const baseCritMultiplierMin = Math.min(...criticalMultipliers);
  const totalCritPercent = Math.max(0, Math.min(100, Number(stats?.crit ?? martial?.crit_percent) || 0));
  const hitModel = martialHitModel(martial, totalCritPercent);
  const hitProfiles = hitModel.profiles;
  const panelCritDamage = Number(stats?.critDamage) || 0;
  const defaultCritDamageValue = baseCritMultiplier * 100 + panelCritDamage;
  const customCritDamageValue = critDamageValue === null || critDamageValue === undefined
    ? NaN
    : Number(critDamageValue);
  const resolvedCritDamageValue = Number.isFinite(customCritDamageValue)
    ? Math.max(0, customCritDamageValue)
    : defaultCritDamageValue;
  const critMultiplier = resolvedCritDamageValue / 100;
  const segmentCritMultipliers = hitProfiles.map((profile, index) => {
    const baseMultiplier = criticalMultipliers[Math.min(index, criticalMultipliers.length - 1)] || baseCritMultiplier;
    return Math.max(0, critMultiplier - (baseCritMultiplier - baseMultiplier));
  });
  const normalSegments = hitProfiles.map((profile) => ({
    ...profile,
    min: trunc(effectiveAttack * 0.9 * profile.segments * finalDamageMultiplier),
    max: trunc(effectiveAttack * 1.1 * profile.segments * finalDamageMultiplier),
  }));
  const criticalSegments = hitProfiles.map((profile, index) => {
    const multiplierTotal = segmentCritMultipliers.slice(0, profile.segments)
      .reduce((sum, multiplier) => sum + multiplier, 0);
    return {
      ...profile,
      min: trunc(effectiveAttack * 0.9 * multiplierTotal * finalDamageMultiplier),
      max: trunc(effectiveAttack * 1.1 * multiplierTotal * finalDamageMultiplier),
    };
  });
  const maxNormal = normalSegments.map((profile) => ({
    ...profile,
    min: trunc(maxEffectiveAttack * 0.9 * profile.segments * finalDamageMultiplier),
    max: trunc(maxEffectiveAttack * 1.1 * profile.segments * finalDamageMultiplier),
  }));
  const maxCritical = criticalSegments.map((profile) => {
    const multiplierTotal = segmentCritMultipliers.slice(0, profile.segments)
      .reduce((sum, multiplier) => sum + multiplier, 0);
    return {
      ...profile,
      min: trunc(maxEffectiveAttack * 0.9 * multiplierTotal * formationDamageMultiplier * postDamageMultiplier),
      max: trunc(maxEffectiveAttack * 1.1 * multiplierTotal * formationDamageMultiplier * postDamageMultiplier),
    };
  });
  const normal = normalSegments[0];
  const critical = criticalSegments[0];
  const theoreticalMax = Math.max(maxNormal[maxNormal.length - 1].max, maxCritical[maxCritical.length - 1].max);
  const expectedBaseUnit = expectedEffectiveAttack * formationDamageMultiplier;
  const expectedDamage = hitProfiles.reduce((sum, profile, index) => {
    const reachProbability = Math.max(0, Math.min(1, Number(profile.reachProbabilityRaw
      ?? (Number(profile.reachProbability) || 0) / 100)));
    const critChance = Math.max(0, Math.min(1, Number(profile.critProbabilityRaw
      ?? (Number(profile.critProbability ?? totalCritPercent) || 0) / 100)));
    const critMultiplierForHit = segmentCritMultipliers[index] || critMultiplier;
    let hitMultiplier = 1 + critChance * (critMultiplierForHit - 1);
    if (postDamageRule.trigger === 'always') {
      hitMultiplier *= postDamageMultiplier;
    } else if (postDamageRule.trigger === 'crit') {
      hitMultiplier += critChance * (postDamageRule.chancePercent / 100)
        * critMultiplierForHit * (postDamageMultiplier - 1);
    }
    return sum + reachProbability * hitMultiplier;
  }, 0) * expectedBaseUnit;
  const expectedSegments = hitModel.expectedSegments;
  const attachmentText = damageEffects.length ? '(攻击+附伤)' : '攻击';
  const postText = postDamageRule.trigger === 'always'
    ? '后置附伤'
    : postDamageRule.trigger === 'crit'
      ? '暴击后附伤'
      : '';
  const comboText = hitModel.combo
    ? '暴击连击（低于阈值停止）'
    : '';
  const formulaParts = [
    `${attachmentText}×系数×浮动×免伤`,
    '暴击×爆伤',
    formationDamageMultiplier !== 1 ? '阵法独立乘区' : '',
    postText,
    comboText,
    haremAttackMultiplier !== 1 ? '后宫独立乘区' : '',
  ].filter(Boolean);
  const formula = formulaParts.join(' · ');
  return {
    range: martialRange(martial),
    segmentCount: hitProfiles.length,
    hitProfiles,
    hitProbabilityLabel: martialHitProbabilityLabel(martial, totalCritPercent),
    normalSegments,
    criticalSegments,
    normal,
    critical,
    baseCritMultiplier,
    baseCritMultiplierMin,
    panelCritDamage,
    critMultiplier,
    critDamagePercent: Number((critMultiplier * 100).toFixed(2)),
    generatedCritDamagePercent: Number(defaultCritDamageValue.toFixed(2)),
    damageFactor: factor,
    critDamageValue: Number(resolvedCritDamageValue.toFixed(2)),
    baseAttackRaw: Number(baseAttackRaw) || 0,
    weaponWhiteAttack: Number(weaponWhiteAttack) || 0,
    attachmentDamage,
    maxAttachmentDamage,
    attachmentTotals,
    maxAttachmentTotals,
    expectedAttachmentDamage,
    expectedAttachmentTotals,
    maxNormal,
    maxCritical,
    damageEffects,
    guaranteedDamageEffects: guaranteedEffects,
    postDamageMultiplier,
    postDamageTrigger: postDamageRule.trigger,
    postDamageChancePercent: postDamageRule.chancePercent,
    alwaysPostDamageMultiplier,
    formationDamagePercent: Math.max(0, Number(formationDamagePercent) || 0),
    formationDamageMultiplier,
    finalDamageMultiplier,
    targetMitigation: mitigation,
    totalCritPercent,
    expectedSegments,
    expectedDamage,
    formula,
    upperLimitProbability: damageUpperLimitProbability(martial, totalCritPercent),
    max: theoreticalMax,
  };
}
function renderDamagePreview(damage) {
  const section = $('damage-preview-section');
  if (!section) return;
  if (!damage) {
    section.hidden = true;
    $('damage-preview-context').textContent = '未选择武学';
    $('damage-normal-range').textContent = '--';
    $('damage-crit-range').textContent = '--';
    $('damage-max-value').textContent = '--';
    $('damage-max-probability').textContent = '上限概率 --';
    $('damage-expected-value').textContent = '--';
    $('damage-preview-formula').textContent = '--';
    $('harem-bonus-control').hidden = true;
    return;
  }
  section.hidden = false;
  const selection = getSelectedMartial();
  const item = selection?.item || {};
  const formatSegmentRanges = (ranges) => ranges.length > 1
    ? ranges.map((range) => `${range.segments}段 ${formatNumber(range.min)}～${formatNumber(range.max)}`).join(' · ')
    : `${formatNumber(ranges[0].min)}～${formatNumber(ranges[0].max)}`;
  $('damage-preview-context').textContent = `${item.name || item.nick || '当前武学'} · ${damage.range}${damage.hitProbabilityLabel ? ` · ${damage.hitProbabilityLabel}` : ''}`;
  $('damage-normal-range').title = damage.segmentCount > 1 ? '按不同段数分别显示普通伤害范围' : '本次出手必定附伤下的普通伤害范围';
  $('damage-crit-range').title = damage.segmentCount > 1 ? '按不同段数分别显示暴击伤害范围' : '本次出手必定附伤下的暴击伤害范围';
  $('damage-max-value').title = '包含最高段数和已知概率/周期附伤都触发时的理论上限';
  $('damage-normal-range').textContent = formatSegmentRanges(damage.normalSegments);
  $('damage-crit-range').textContent = formatSegmentRanges(damage.criticalSegments);
  $('damage-max-value').textContent = formatNumber(damage.max);
  $('damage-max-probability').textContent = `上限概率 ${formatPercent(damage.upperLimitProbability)}`;
  $('damage-expected-value').textContent = formatNumber(Math.round(damage.expectedDamage));
  $('damage-preview-formula').textContent = damage.formula;
  [
    ['damage-target-mitigation', damage.targetMitigation],
    ['damage-factor', damage.damageFactor],
    ['damage-crit-adjustment', damage.critDamageValue],
  ].forEach(([id, value]) => {
    const input = $(id);
    if (document.activeElement !== input) input.value = value;
  });
}
function martialSpeed(selection = getSelectedMartial()) {
  return Number(selection?.item?.speed) || 0;
}
function martialStyle(item) {
  if (MARTIAL_STYLE_KEYS.includes(item?.style)) return item.style;
  return ({ 1: '拳法', 2: '剑法', 3: '刀法', 4: '棍法' })[Number(item?.type)] || '';
}
function getCharacterProfile(name = $('person-name')?.value) {
  return state.whiteRabbit?.characters?.find((character) => character.name === name) || null;
}
function styleOptionFromMartialStyle(style) {
  return ({ 拳法: '拳主', 剑法: '剑主', 刀法: '刀主', 棍法: '棍主' })[style] || '';
}
function currentMartialStyle() {
  const personName = $('person-name')?.value.trim() || '自定义角色';
  const profile = getCharacterProfile(personName);
  if (personName !== '主角' && profile?.style) {
    return ['全能', '拳剑刀棍'].includes(profile.style) ? '' : profile.style;
  }
  const selectedStyle = $('person-style')?.value || '';
  return ({ 拳主: '拳法', 剑主: '剑法', 刀主: '刀法', 棍主: '棍法' })[selectedStyle] || selectedStyle;
}
function martialStyleEligible(item) {
  const scope = String(item?.scope || '');
  const personName = $('person-name')?.value.trim() || '自定义角色';
  if (scope.includes('陆仁甲') && personName !== '陆仁甲') return false;
  if (scope.includes('剑主') && currentMartialStyle() !== '剑法') return false;
  const style = currentMartialStyle();
  return !style || style === '全能' || style === '拳剑刀棍' || martialStyle(item) === style;
}
function applyCharacterDefaults({ resetBaseStats = true } = {}) {
  const profile = getCharacterProfile();
  let changed = false;
  const personName = $('person-name').value.trim() || '自定义角色';
  if (resetBaseStats) {
    const baseStats = { ...DEFAULT_CHARACTER_BASE_STATS, ...(profile?.base_stats || {}) };
    Object.entries(CHARACTER_BASE_STAT_FIELDS).forEach(([key, id]) => {
      const value = Number(baseStats[key]) || 0;
      if (Number($(id).value) !== value) {
        $(id).value = value;
        changed = true;
      }
    });
  }
  if (personName !== '自定义角色') {
    const achievementDefault = personName === '主角' ? 292 : 177;
    ['achievement-hp', 'achievement-attack'].forEach((id) => {
      const current = Number($(id).value);
      if (current === 177 || current === 292) {
        if (current !== achievementDefault) {
          $(id).value = achievementDefault;
          changed = true;
        }
      }
    });
  }
  const styleControl = $('person-style');
  if (!profile) {
    styleControl.disabled = false;
    return changed;
  }
  if (Number.isFinite(Number(profile.hp_factor))) {
    $('hp-factor').value = profile.hp_factor;
    changed = true;
  }
  if (Number.isFinite(Number(profile.power_factor))) {
    $('power-factor').value = profile.power_factor;
    changed = true;
  }
  const profileStyle = styleOptionFromMartialStyle(profile.style);
  if (profileStyle) {
    if (styleControl.value !== profileStyle) {
      styleControl.value = profileStyle;
      changed = true;
    }
    styleControl.disabled = true;
  } else {
    styleControl.disabled = false;
  }
  return changed;
}
function populateCharacterPresets() {
  const list = $('person-name');
  if (!list) return;
  const names = new Set(['主角', ...(state.whiteRabbit?.characters || []).map((character) => character.name).filter(Boolean), '自定义角色']);
  list.replaceChildren();
  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    list.appendChild(option);
  });
  list.value = '主角';
  applyCharacterDefaults();
}
function techniqueOptionEntries() {
  const entries = [];
  (state.whiteRabbit?.techniques || []).forEach((technique, index) => {
    if (technique.calculate === false) return;
    if (technique.name === '赌术' || technique.name === '任督二脉') return;
    if (technique.group === 'wolong' && Array.isArray(technique.choices)) {
      technique.choices.forEach((choice, choiceIndex) => {
        entries.push({
          id: `wolong:${index}:${choiceIndex}`,
          ...technique,
          ...choice,
          name: choice.name,
          parentName: technique.name,
          group: 'wolong',
          group_label: technique.group_label || '卧龙心诀（三选一）',
        });
      });
      return;
    }
    const inferredGroup = ['拳主', '剑主', '刀主', '棍主'].some((item) => String(technique.scope || '').includes(item))
      ? 'profession'
      : undefined;
    entries.push({ id: String(index), ...technique, group: technique.group || inferredGroup });
  });
  return entries;
}

function techniqueDisplayName(technique) {
  const name = technique?.name || '未命名技艺';
  if (technique?.group === 'wolong') return `卧龙心诀·${name}（三选一）`;
  if (technique?.group === 'jiuyin') return `九阴奇功·${name}（七选一）`;
  return name;
}

function getWhiteTechnique(id) {
  return techniqueOptionEntries().find((item) => String(item.id) === String(id)) || null;
}

function effects(record) {
  const values = [];
  ['e1', 'e2'].forEach((key) => { if (record?.[key]) values.push(record[key]); });
  if (Array.isArray(record?.eff)) values.push(...record.eff);
  if (Array.isArray(record?.tx)) values.push(...record.tx);
  return values;
}
function effectSum(record, type) {
  return effects(record).filter((effect) => Number(effect.t) === type)
    .reduce((sum, effect) => sum + Number(effect.v || 0), 0);
}
const EQUIPMENT_SECONDARY_EFFECTS = {
  65536: 'speed',
  4: 'crit',
  16: 'dodge',
  64: 'block',
  524288: 'mitigation',
  2097152: 'lifesteal',
  33554432: 'reflect',
  134217728: 'critDamage',
};
const INNER_SECONDARY_EFFECTS = {
  524288: 'mitigation',
  2097152: 'lifesteal',
  8388608: 'recovery',
  33554432: 'reflect',
};
function innerSecondaryFromEffect(effect) {
  const stats = emptySecondaryStats();
  const text = String(effect?.desp || '');
  const value = Number(effect?.v) || 0;
  if (!value) return stats;
  if (text.includes('转化为气血')) stats.lifesteal += value;
  else if (text.includes('吸收') && text.includes('伤害')) stats.mitigation += value;
  else if (text.includes('反震')) stats.reflect += value;
  else if (text.includes('暴击伤害') || text.includes('爆伤')) stats.critDamage += value;
  else if (text.includes('暴击')) stats.crit += value;
  else if (text.includes('速度')) stats.speed += value;
  else if (text.includes('恢复') || text.includes('回复')) stats.recovery += value;
  else {
    const key = INNER_SECONDARY_EFFECTS[Number(effect?.t)];
    if (key) stats[key] += value;
  }
  return stats;
}
function secondaryStatsFromEquipment(item) {
  const stats = emptySecondaryStats();
  effects(item).forEach((effect) => {
    const key = EQUIPMENT_SECONDARY_EFFECTS[Number(effect.t)];
    if (key) stats[key] += Number(effect.v) || 0;
  });
  return stats;
}
function equipmentStats(item) {
  return {
    hp: Number(item?.hp_percent) || effectSum(item, 2),
    attack: Number(item?.attack_percent) || effectSum(item, 131072),
    hpFlat: Number(item?.hp_flat) || effectSum(item, 1),
    attackFlat: Number(item?.attack_flat) || 0,
    secondary: item?.source === 'white'
      ? secondaryStatsFromRecord(item)
      : secondaryStatsFromEquipment(item),
  };
}
function equipmentName(item) { return item?.nick || item?.name || '未命名装备'; }
function equipmentSummary(item) {
  const stats = equipmentStats(item);
  const parts = [];
  if (stats.hpFlat) parts.push(`${formatNumber(stats.hpFlat)}血`);
  if (stats.hp) parts.push(`${formatPercent(stats.hp)}血`);
  if (stats.attackFlat) parts.push(`${formatNumber(stats.attackFlat)}攻`);
  if (stats.attack) parts.push(`${formatPercent(stats.attack)}攻`);
  SECONDARY_STAT_DEFS.forEach((definition) => {
    const value = stats.secondary[definition.key];
    if (value) parts.push(`${formatSecondaryValue(definition.key, value)}${definition.label}`);
  });
  return parts.join(' ') || '无属性';
}
function innerLevelValue() {
  return Math.max(1, Math.min(9, Math.round(numberValue('neigong-level', 9))));
}
function innerEffectTotals(record, level) {
  const entries = Array.isArray(record?.eff) ? record.eff : effects(record);
  const limit = Math.max(0, Math.min(entries.length, Math.round(Number(level) || 0)));
  return entries.slice(0, limit).reduce((totals, effect) => {
    const type = Number(effect.t);
    if (type === 2) totals.hp += Number(effect.v || 0);
    if (type === 131072) totals.attack += Number(effect.v || 0);
    addStylePower(totals.stylePower, stylePowerFromEffect(effect));
    addSecondaryStats(totals.secondary, innerSecondaryFromEffect(effect));
    return totals;
  }, { hp: 0, attack: 0, stylePower: emptyStylePower(), secondary: emptySecondaryStats() });
}
function martialIsSGrade(martial) {
  return /S$/i.test(String(martial?.rank || '').trim());
}
function innerSpecialStats(item, martial) {
  const secondary = emptySecondaryStats();
  const stylePower = emptyStylePower();
  const martialName = String(martial?.name || martial?.nick || '').trim();
  const martialStyleName = martialStyle(martial);
  const special = String(item?.special || '');
  const numberBefore = (pattern) => Number(special.match(pattern)?.[1]) || 0;

  // These descriptions contain values for a named martial art, not global
  // panel stats. Keep the plain text for the encyclopedia, but only apply the
  // numeric effect after the current martial art satisfies its condition.
  if (item?.name === '白兔心决') {
    addSecondaryStats(secondary, secondaryStatsFromText(special));
  }
  if (item?.name === '葵花宝典' && ['辟魔剑法', '辟邪剑法'].includes(martialName)) {
    secondary.crit += numberBefore(/(\d+(?:\.\d+)?)%暴击率/);
  }
  if (item?.name === '紫霞真气'
    && martialStyleName === '剑法'
    && /气宗/.test(martialName)) {
    secondary.crit += numberBefore(/(\d+(?:\.\d+)?)%暴击/);
  }
  if (item?.name === '金顶莲华经' && ['曜日破云掌', '倚天剑诀'].includes(martialName)) {
    secondary.crit += numberBefore(/(\d+(?:\.\d+)?)%暴击/);
  }
  if (item?.name === '纯阳无极功'
    && martialIsSGrade(martial)
    && ['拳法', '剑法'].includes(martialStyleName)) {
    secondary.crit += numberBefore(/(\d+(?:\.\d+)?)%暴击率/);
  }

  if (item?.name === '易筋经'
    && ['光明拳', '一指禅', '般若禅掌', '十二擒拿手', '定珠降魔神功'].includes(martialName)) {
    return {
      secondary,
      stylePower,
      martialAttackPercent: numberBefore(/(\d+(?:\.\d+)?)%攻击/),
    };
  }
  if (item?.name === '离合神功' && martialIsSGrade(martial) && martialStyleName === '剑法') {
    stylePower.剑法 += numberBefore(/(\d+(?:\.\d+)?)%威力/);
  }
  if (item?.name === '两仪玄元功'
    && martialStyleName === '刀法'
    && (martialName === '太虚神悟刀' || /太乙/.test(String(martial?.access || '')))) {
    stylePower.刀法 += numberBefore(/威力(\d+(?:\.\d+)?)%/);
  }
  if (item?.name === '玄同归藏诀' && martialName === '大同天演剑') {
    stylePower.剑法 += numberBefore(/(\d+(?:\.\d+)?)%大同天演剑威力/);
  }
  return { secondary, stylePower, martialAttackPercent: 0 };
}
function setInnerStatsMode(mode) {
  $('neigong-hp').dataset.mode = mode;
  $('neigong-attack').dataset.mode = mode;
}
function innerStatsMode() {
  return $('neigong-hp').dataset.mode === 'manual' ? 'manual' : 'auto';
}
function customInnerStats() {
  const secondary = emptySecondaryStats();
  SECONDARY_KEYS.forEach((key) => {
    const inputId = `neigong-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    secondary[key] = numberValue(inputId);
  });
  return {
    hp: numberValue('neigong-hp'),
    attack: numberValue('neigong-attack'),
    stylePower: emptyStylePower(),
    directHp: numberValue('neigong-hp'),
    directAttack: numberValue('neigong-attack'),
    secondary,
  };
}
function autoInnerStats(selection = getSelectedInner()) {
  if (!selection) return null;
  if (selection.source === 'custom') return customInnerStats();
  if (selection.source === 'white') {
    const item = selection.item || {};
    const secondary = secondaryStatsFromRecord(item);
    const specialStats = innerSpecialStats(item, getSelectedMartial()?.item);
    addSecondaryStats(secondary, specialStats.secondary);
    return {
      hp: Number(item.hp_percent) || 0,
      attack: Number(item.attack_percent) || 0,
      stylePower: specialStats.stylePower,
      martialAttackPercent: specialStats.martialAttackPercent,
      directHp: Number(item.hp_percent) || 0,
      directAttack: Number(item.attack_percent) || 0,
      secondary,
    };
  }
  if (selection.source !== 'game' || !selection.item) return null;
  const level = innerLevelValue();
  const direct = innerEffectTotals(selection.item, level);
  return {
    // The selected inner skill contributes its t=2/t=131072 effects here.
    // getHpFromNeiGong2 is a separate map-based path and must not use star.
    hp: direct.hp,
    attack: direct.attack,
    stylePower: direct.stylePower,
    martialAttackPercent: 0,
    directHp: direct.hp,
    directAttack: direct.attack,
    secondary: direct.secondary,
  };
}
function syncAutoInnerStats() {
  if (innerStatsMode() !== 'auto') return;
  const stats = autoInnerStats();
  if (!stats) return;
  $('neigong-hp').value = stats.hp;
  $('neigong-attack').value = stats.attack;
}
function renderInnerEditor() {
  const editor = $('custom-inner-editor');
  if (!editor) return;
  const isCustom = getSelectedInner()?.source === 'custom';
  editor.hidden = !isCustom;
  editor.open = isCustom;
}
function getSelectedInner() {
  const value = $('neigong-select').value;
  if (!value) return null;
  if (value === 'custom') return { source: 'custom', item: null };
  if (value.startsWith('wr:')) return { source: 'white', item: getWhiteInner(value.slice(3)) };
  if (value.startsWith('old:')) {
    const item = state.data?.neiGong?.[value.slice(4)];
    return item ? { source: 'game', item } : null;
  }
  return null;
}
function haremBonusEligible(martial = getSelectedMartial()?.item, inner = getSelectedInner()) {
  const personName = $('person-name')?.value.trim() || '自定义角色';
  const isFemaleMain = personName === '主角' && $('person-gender')?.value === '女号';
  if (!isFemaleMain) return false;

  const martialExcluded = Boolean(martial)
    && HAREM_EXCLUDED_MARTIALS.has(normalizedDataName(martial.name || martial.nick));
  const whiteRabbitInner = inner?.source === 'white';
  return !martialExcluded || !whiteRabbitInner;
}
function renderHaremBonusControl(martial = getSelectedMartial()?.item, inner = getSelectedInner()) {
  const control = $('harem-bonus-control');
  const checkbox = $('harem-bonus-enabled');
  if (!control || !checkbox) return false;
  const eligible = haremBonusEligible(martial, inner);
  control.hidden = !eligible;
  control.classList.toggle('is-enabled', eligible && checkbox.checked);
  if (!eligible) {
    checkbox.checked = false;
    control.classList.remove('is-enabled');
    return false;
  }
  if (!haremBonusCustomized) checkbox.checked = true;
  control.classList.toggle('is-enabled', checkbox.checked);
  return checkbox.checked;
}
function innerScopeEligible(item) {
  const scope = String(item?.scope || '').replace(/\s/g, '');
  const personName = $('person-name')?.value.trim() || '自定义角色';
  if (!scope || scope.includes('修炼者') || scope.includes('全队')) return true;
  if (scope.includes('剑主')) return personName === '主角' && currentMartialStyle() === '剑法';
  if (scope.includes('主角')) return personName === '主角';
  return scope.split(/[，,、]/).includes(personName);
}
function techniqueScopeStatus(technique) {
  const scope = String(technique?.scope || '');
  const personName = $('person-name').value.trim() || '自定义角色';
  const restrictedGroup = technique?.group === 'jiuyin' || technique?.group === 'wolong';
  if (restrictedGroup && personName !== '主角' && personName !== '陆仁甲') return false;
  if (personName === '陆仁甲' && technique?.name === '沧浪斩') return false;
  const style = $('person-style').value;
  if (scope.includes('学习千山寂雪')) return false;
  if (!techniqueGenderEligible(technique)) return false;
  if (!scope) return true;
  if (personName === '陆仁甲') return true;
  if (scope.includes('全队')) return true;
  const requiredStyle = ['拳主', '剑主', '刀主', '棍主'].find((item) => scope.includes(item));
  if (personName === '陆仁甲' && (scope.includes('主角') || requiredStyle)) return true;
  if (requiredStyle) return personName === '主角' && style === requiredStyle;
  if (scope.includes('主角')) return personName === '主角';
  return scope.split(/[，,、]/).map((item) => item.trim()).includes(personName);
}
function techniqueGenderEligible(technique) {
  const scope = String(technique?.scope || '');
  const gender = $('person-gender').value;
  const personName = $('person-name').value.trim() || '自定义角色';
  if (scope.includes('女号') && gender !== '女号') return false;
  if (scope.includes('男号') && gender !== '男号') return false;
  if (personName === '胡休') {
    if (technique?.name === '横练护体气功') return gender === '男号';
    if (technique?.name === '龙象护体功') return gender === '女号';
  }
  return true;
}
function techniqueAccountEligible(technique) {
  const scope = String(technique?.scope || '');
  const personName = $('person-name').value.trim() || '自定义角色';
  const restrictedGroup = technique?.group === 'jiuyin' || technique?.group === 'wolong';
  if (restrictedGroup && personName !== '主角' && personName !== '陆仁甲') return false;
  if (personName === '陆仁甲' && technique?.name === '沧浪斩') return false;
  const gender = $('person-gender').value;
  const style = $('person-style').value;
  if (scope.includes('学习千山寂雪')) return false;
  if (!techniqueGenderEligible(technique)) return false;
  if (personName === '陆仁甲') return true;
  const requiredStyle = ['拳主', '剑主', '刀主', '棍主'].find((item) => scope.includes(item));
  if (scope.includes('全队') || !scope) return true;
  if (personName === '陆仁甲' && (scope.includes('主角') || requiredStyle)) return true;
  if (requiredStyle) return personName === '主角' && (!style || requiredStyle === style);
  if (scope.includes('主角')) return personName === '主角';
  return scope.split(/[，,、]/).map((item) => item.trim()).includes(personName);
}
function techniqueStats(technique) {
  const structuredSecondary = technique?.secondary && typeof technique.secondary === 'object'
    ? technique.secondary
    : {};
  const totals = {
    hp: Number(technique?.hp_percent) || 0,
    attack: Number(technique?.attack_percent) || 0,
    recoveryBasePercent: Number(technique?.recovery_base_percent) || 0,
    stylePower: stylePowerFromText(technique?.effect),
    secondary: emptySecondaryStats(),
  };
  addSecondaryStats(totals.secondary, structuredSecondary);
  const parsedSecondary = secondaryStatsFromText(technique?.effect);
  // Structured values are canonical. Text parsing only fills fields that do
  // not already exist in the record, preventing choice effects from doubling.
  SECONDARY_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(structuredSecondary, key)) parsedSecondary[key] = 0;
  });
  // 玄武的“10%恢复”是基础生命转化出的回复量，不是回复百分比。
  parsedSecondary.recovery -= totals.recoveryBasePercent;
  addSecondaryStats(totals.secondary, parsedSecondary);
  return totals;
}
function techniqueStatsLabel(technique) {
  const stats = techniqueStats(technique);
  const parts = [];
  if (stats.hp) parts.push(`${formatPercent(stats.hp)}血`);
  if (stats.attack) parts.push(`${formatPercent(stats.attack)}攻`);
  if (stats.recoveryBasePercent) parts.push(`${formatPercent(stats.recoveryBasePercent)}回复量`);
  const styleLabels = {
    拳法: '拳脚威力',
    剑法: '剑法威力',
    刀法: '刀法威力',
    棍法: '棍法威力',
  };
  MARTIAL_STYLE_KEYS.forEach((style) => {
    const value = stats.stylePower[style];
    if (value) parts.push(`${formatPercent(value)}${styleLabels[style]}`);
  });
  SECONDARY_STAT_DEFS.forEach((definition) => {
    const value = stats.secondary[definition.key];
    if (value) {
      const formatted = definition.key === 'recovery'
        ? formatPercent(value)
        : formatSecondaryValue(definition.key, value);
      parts.push(`${formatted}${definition.label}`);
    }
  });
  return parts.join(' · ') || '属性待补';
}
function selectedTechniqueIds() {
  return [...document.querySelectorAll('.technique-option:checked')].map((input) => input.value);
}
function defaultTechniqueIds() {
  const personName = $('person-name').value.trim() || '自定义角色';
  const style = $('person-style').value;
  const gender = $('person-gender').value;
  const isMain = personName === '主角';
  const isLuRenJia = personName === '陆仁甲';
  const excluded = new Set(['赌术', '任督二脉', '一苇渡江术', '洗髓伐骨']);
  return techniqueOptionEntries()
    .filter((technique) => {
      if (excluded.has(technique.name) || technique.group === 'jiuyin' || technique.group === 'wolong') return false;
      if (isLuRenJia && technique.name === '沧浪斩') return false;
      if (!techniqueAccountEligible(technique)) return false;
      const scope = String(technique.scope || '').replace(/\s/g, '');
      if (scope.includes('女号') && gender !== '女号') return false;
      if (scope.includes('男号') && gender !== '男号') return false;
      if (!scope || scope.includes('全队')) return true;
      if (personName === '胡休') {
        if (scope !== '胡休') return false;
        return (gender === '女号' && technique.name === '龙象护体功')
          || (gender === '男号' && technique.name === '横练护体气功');
      }
      if (isMain || isLuRenJia) {
        const requiredStyle = ['拳主', '剑主', '刀主', '棍主'].find((item) => scope.includes(item));
        if (requiredStyle) return isLuRenJia || style === requiredStyle;
        return scope.includes('主角');
      }
      return false;
    })
    .map((technique) => String(technique.id));
}
function setTechniqueSelections(ids, { customized = techniqueSelectionCustomized } = {}) {
  techniqueSelectionCustomized = customized;
  const selected = new Set((ids || []).map((id) => String(id)));
  document.querySelectorAll('.technique-option').forEach((input) => {
    input.checked = selected.has(input.value);
  });
  refreshTechniqueAvailability();
}
function selectedTechniques() {
  return selectedTechniqueIds().map(getWhiteTechnique).filter(Boolean);
}
function techniqueTotals() {
  const totals = { hp: 0, attack: 0, recoveryBasePercent: 0, stylePower: emptyStylePower(), secondary: emptySecondaryStats(), applied: [], skipped: [] };
  selectedTechniques().forEach((technique) => {
    if (!techniqueScopeStatus(technique)) {
      totals.skipped.push(technique.name);
      return;
    }
    const stats = techniqueStats(technique);
    totals.hp += stats.hp;
    totals.attack += stats.attack;
    totals.recoveryBasePercent += stats.recoveryBasePercent;
    addStylePower(totals.stylePower, stats.stylePower);
    addSecondaryStats(totals.secondary, stats.secondary);
    totals.applied.push(technique.name);
  });
  return totals;
}
function setTechniqueStatsMode(mode) {
  $('technique-hp').dataset.mode = mode;
  $('technique-attack').dataset.mode = mode;
}
function techniqueStatsMode() {
  return $('technique-hp').dataset.mode === 'auto' ? 'auto' : 'manual';
}
function syncTechniqueStats() {
  renderTechniqueScope();
}
function renderTechniqueScope() {
  const selected = selectedTechniques();
  const summary = $('technique-summary');
  if (!selected.length) {
    $('technique-scope').textContent = '未选择技艺 · 普通技艺可多选';
    if (summary) summary.textContent = '未选择';
    return;
  }
  const applied = selected.filter(techniqueScopeStatus).length;
  const skipped = selected.length - applied;
  $('technique-scope').textContent = `已选 ${selected.length} 项 · 当前角色生效 ${applied} 项${skipped ? ` · 不适用 ${skipped} 项` : ''}`;
  if (summary) summary.textContent = `${applied}/${selected.length} 生效`;
}
function applyDefaultTechniqueSelections() {
  if (techniqueSelectionCustomized) return;
  setTechniqueSelections(defaultTechniqueIds(), { customized: false });
  renderTechniqueScope();
}
function refreshTechniqueAvailability() {
  document.querySelectorAll('.technique-option').forEach((input) => {
    const technique = getWhiteTechnique(input.value);
    const eligible = techniqueAccountEligible(technique);
    input.disabled = !eligible;
    input.closest('.technique-choice')?.classList.toggle('is-unavailable', !eligible);
    if (!eligible) input.checked = false;
  });
}
function populateTechniques() {
  const container = $('technique-options');
  container.replaceChildren();
  const groups = new Map();
  techniqueOptionEntries().forEach((technique) => {
    const group = technique.group || 'normal';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(technique);
  });
  const groupLabels = {
    normal: '普通技艺（可多选）',
    profession: '职业技艺（四选一）',
    jiuyin: '九阴奇功（七选一）',
    wolong: '卧龙心诀（三选一）',
  };
  ['normal', 'profession', 'jiuyin', 'wolong'].forEach((group) => {
    const items = groups.get(group) || [];
    if (!items.length) return;
    const fieldset = document.createElement('fieldset');
    fieldset.className = `technique-group technique-group-${group}`;
    const legend = document.createElement('legend');
    legend.textContent = groupLabels[group] || items[0].group_label || group;
    fieldset.appendChild(legend);
    const grid = document.createElement('div');
    grid.className = 'technique-choice-grid';
    items.forEach((technique) => {
      const label = document.createElement('label');
      label.className = 'technique-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'technique-option';
      input.value = technique.id;
      input.dataset.exclusiveGroup = group === 'normal' ? '' : group;
      const title = document.createElement('span');
      title.className = 'technique-choice-name';
      title.textContent = techniqueDisplayName(technique);
      const stats = document.createElement('small');
      stats.textContent = `${techniqueStatsLabel(technique)} · ${technique.scope || '全队'}`;
      label.append(input, title, stats);
      grid.appendChild(label);
    });
    fieldset.appendChild(grid);
    container.appendChild(fieldset);
  });
  setTechniqueSelections(defaultTechniqueIds(), { customized: false });
  setTechniqueStatsMode('manual');
  renderTechniqueScope();
}
function applyTechniqueSelection() {
  renderTechniqueScope();
  calculate();
}
function equipmentSlotActive(slot) {
  return Boolean(slot?.id || String(slot?.name || '').trim() || Number(slot?.hp) || Number(slot?.attack));
}
function customEquipmentId(slotIndex) { return `custom-equipment:${slotIndex}`; }
function isCustomEquipmentId(id) { return String(id || '').startsWith('custom-equipment:'); }
function normalizeCustomEquipment(value, id) {
  return {
    id: String(id),
    name: String(value?.name || ''),
    hp: Number(value?.hp) || 0,
    attack: Number(value?.attack) || 0,
    hpFlat: Number(value?.hpFlat) || 0,
    attackFlat: Number(value?.attackFlat) || 0,
    secondary: { ...emptySecondaryStats(), ...(value?.secondary || {}) },
    extra: String(value?.extra || ''),
  };
}
function weaponActive() {
  return state.weaponMode !== 'empty' && Boolean(state.weaponId || String(state.weaponName || '').trim() || state.weaponAffixes.some((affix) => Number(affix.value)));
}
function parseWeaponForgeOption(value) {
  const text = String(value || '').trim();
  const match = text.match(/^([+-]?\d+(?:\.\d+)?)\s*(吸血|暴击伤害|爆伤|暴击率|暴击|速度|反伤|闪避|格挡|招架|血|生命|攻击)$/);
  if (!match) return null;
  const key = {
    血: 'hp', 生命: 'hp', 攻击: 'attack', 速度: 'speed', 吸血: 'lifesteal',
    暴击: 'crit', 暴击率: 'crit', 暴击伤害: 'critDamage', 爆伤: 'critDamage',
    反伤: 'reflect', 闪避: 'dodge', 格挡: 'block', 招架: 'block',
  }[match[2]];
  if (!key) return null;
  const mode = ['speed', 'block', 'dodge'].includes(key) ? 'flat' : 'percent';
  return { key, mode, value: Number(match[1]) || 0 };
}
function calculatorWeaponAttackFlat(item) {
  return Math.round((Number(item?.attack_flat) || 0) * 1.72);
}
function weaponStyle(item) {
  return ({
    'weapon-fist': '拳法',
    'weapon-sword': '剑法',
    'weapon-blade': '刀法',
    'weapon-staff': '棍法',
  })[String(item?.slot || '')] || '';
}
function weaponStyleEligible(item) {
  const style = currentMartialStyle();
  return !style || style === '全能' || style === '拳剑刀棍' || weaponStyle(item) === style;
}
function selectedWeaponForgeAffix(item = getWhiteEquipment(state.weaponId)) {
  if (!item || !state.weaponForgeOption) return null;
  return parseWeaponForgeOption(state.weaponForgeOption);
}
function populateWeaponAffixes() {
  const weaponSelect = $('weapon-select');
  const selectedWeapon = getWhiteEquipment(state.weaponId);
  if (state.weaponMode === 'builtin' && selectedWeapon && !weaponStyleEligible(selectedWeapon)) {
    state.weaponId = '';
    state.weaponName = '';
    state.weaponMode = 'empty';
    state.weaponForgeOption = '';
  }
  if (weaponSelect) {
    weaponSelect.innerHTML = '<option value="">未选择</option><option value="custom">自定义武器</option>';
    (state.whiteRabbit?.equipment || []).filter((item) => isWeapon(item) && isSEquipment(item) && weaponStyleEligible(item)).forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = `${equipmentName(item)} · ${equipmentSummary(item)}`;
      option.title = item.access ? `获取：${item.access}` : '';
      weaponSelect.appendChild(option);
    });
  }
  document.querySelectorAll('.weapon-affix-key').forEach((select) => {
    select.innerHTML = '<option value="">选择属性</option>';
    WEAPON_ATTRIBUTE_OPTIONS.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.label;
      select.appendChild(option);
    });
  });
  renderWeaponForgeOptions();
  renderWeaponAffixes();
}
function renderWeaponForgeOptions() {
  const field = $('weapon-forge-field');
  const select = $('weapon-forge-select');
  const customFields = $('weapon-custom-fields');
  const editor = $('weapon-editor');
  if (!field || !select || !customFields) return;
  const item = getWhiteEquipment(state.weaponId);
  const options = Array.isArray(item?.forge_options)
    ? item.forge_options.filter((value) => parseWeaponForgeOption(value))
    : [];
  // Keep the manual editor hidden for every selected built-in value, even while
  // a content update is loading.
  const selectedValue = String($('weapon-select')?.value || '').trim();
  const builtIn = state.weaponMode === 'builtin' && Boolean(selectedValue || state.weaponId);
  field.hidden = !builtIn || !options.length;
  customFields.hidden = state.weaponMode !== 'custom';
  if (editor) editor.hidden = state.weaponMode !== 'custom';
  select.replaceChildren();
  if (options.length) {
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '不选';
    select.appendChild(empty);
    options.forEach((value) => {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = String(value);
      select.appendChild(option);
    });
    if (!options.includes(state.weaponForgeOption)) state.weaponForgeOption = '';
    select.value = state.weaponForgeOption;
  } else {
    state.weaponForgeOption = '';
  }
}
function renderWeaponAffixes() {
  if ($('weapon-select')) $('weapon-select').value = state.weaponMode === 'builtin'
    ? state.weaponId || ''
    : state.weaponMode === 'custom' ? 'custom' : '';
  $('weapon-name').value = state.weaponName || '';
  state.weaponAffixes.forEach((affix, index) => {
    $(`weapon-affix-key-${index}`).value = affix.key || '';
    $(`weapon-affix-mode-${index}`).value = affix.mode || 'flat';
    $(`weapon-affix-value-${index}`).value = affix.value || 0;
  });
  renderWeaponForgeOptions();
  updateWeaponSummary();
}
function updateWeaponSummary() {
  const summary = $('weapon-summary');
  if (!summary) return;
  const selectedWeapon = getWhiteEquipment(state.weaponId);
  const weaponName = String(state.weaponName || '').trim() || equipmentName(selectedWeapon);
  const totals = weaponAffixTotals();
  const statParts = [];
  const attack = totals.attackFlat || totals.attackPercent;
  if (attack) {
    statParts.push(`攻 ${totals.attackFlat ? formatNumber(totals.attackFlat) : ''}${totals.attackPercent ? `${totals.attackFlat ? ' · ' : ''}${formatPercent(totals.attackPercent)}` : ''}`);
  }
  if (totals.hpFlat || totals.hpPercent) {
    statParts.push(`血 ${totals.hpFlat ? formatNumber(totals.hpFlat) : ''}${totals.hpPercent ? `${totals.hpFlat ? ' · ' : ''}${formatPercent(totals.hpPercent)}` : ''}`);
  }
  SECONDARY_STAT_DEFS.forEach((definition) => {
    const value = totals.secondary[definition.key];
    if (value) statParts.push(`${definition.label} ${formatSecondaryValue(definition.key, value)}`);
  });
  summary.textContent = weaponActive()
    ? `${weaponName || '已配置'}${statParts.length ? ` · ${statParts.join(' · ')}` : ''}`
    : '未设置';
}
function setError(message) {
  $('error-message').textContent = message;
  $('error-message').hidden = !message;
}
function setSaveStatus(message) { $('save-status').textContent = message; }
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

const selectProxyInstances = new Set();
let selectProxyDocumentEventsBound = false;

function pruneSelectProxies() {
  selectProxyInstances.forEach((select) => {
    if (select.isConnected) return;
    select._selectProxy?.observer?.disconnect();
    selectProxyInstances.delete(select);
  });
}
function selectedOptionText(select) {
  return select.selectedOptions?.[0]?.textContent?.trim() || '请选择';
}
function closeSelectProxies(except = null) {
  selectProxyInstances.forEach((select) => {
    const proxy = select._selectProxy;
    if (proxy && proxy !== except) proxy.wrapper.classList.remove('is-open');
  });
}
function syncSelectProxy(select, rebuild = false) {
  const proxy = selectProxyInstances.has(select) ? select._selectProxy : null;
  if (!proxy) return;
  proxy.label.textContent = selectedOptionText(select);
  proxy.trigger.disabled = select.disabled;
  proxy.wrapper.classList.toggle('is-disabled', select.disabled);
  proxy.trigger.setAttribute('aria-expanded', String(proxy.wrapper.classList.contains('is-open')));
  if (!rebuild) return;
  proxy.list.replaceChildren();
  [...select.children].forEach((child) => {
    if (child.tagName === 'OPTGROUP') {
      const groupLabel = document.createElement('div');
      groupLabel.className = 'select-proxy-group';
      groupLabel.textContent = child.label;
      proxy.list.appendChild(groupLabel);
      [...child.children].forEach((option) => appendSelectProxyOption(select, proxy, option));
    } else if (child.tagName === 'OPTION') {
      appendSelectProxyOption(select, proxy, child);
    }
  });
}
function appendSelectProxyOption(select, proxy, option) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'select-proxy-option';
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(select.value === option.value));
  button.disabled = option.disabled;
  button.textContent = option.textContent || '未命名选项';
  if (select.value === option.value) button.classList.add('is-selected');
  button.addEventListener('click', (event) => {
    event.preventDefault();
    if (option.disabled) return;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeSelectProxies();
    syncSelectProxy(select);
  });
  proxy.list.appendChild(button);
}
function enhanceSelect(select) {
  if (!select || selectProxyInstances.has(select)) return;
  const wrapper = document.createElement('div');
  wrapper.className = `select-proxy${select.classList.contains('compact-picker') ? ' compact-picker-proxy' : ''}`;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-proxy-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.className = 'select-proxy-label';
  trigger.appendChild(label);
  const list = document.createElement('div');
  list.className = 'select-proxy-list';
  list.setAttribute('role', 'listbox');
  wrapper.appendChild(trigger);
  wrapper.appendChild(list);
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add('native-select-source');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const proxy = { wrapper, trigger, label, list };
  select._selectProxy = proxy;
  selectProxyInstances.add(select);
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    if (select.disabled) return;
    const isOpen = wrapper.classList.contains('is-open');
    closeSelectProxies(proxy);
    wrapper.classList.toggle('is-open', !isOpen);
    syncSelectProxy(select);
  });
  select.addEventListener('change', () => {
    syncSelectProxy(select);
    wrapper.classList.remove('is-open');
  });
  const observer = new MutationObserver(() => syncSelectProxy(select, true));
  observer.observe(select, { childList: true, subtree: true, attributes: true });
  proxy.observer = observer;
  syncSelectProxy(select, true);
}
function enhanceSelects(root = document) {
  pruneSelectProxies();
  root.querySelectorAll('select').forEach(enhanceSelect);
  if (!selectProxyDocumentEventsBound) {
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.select-proxy')) closeSelectProxies();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSelectProxies();
    });
    selectProxyDocumentEventsBound = true;
  }
}
function refreshSelectProxies() {
  pruneSelectProxies();
  selectProxyInstances.forEach((select) => syncSelectProxy(select));
}

function currentConfig() {
  const selectedText = (id) => $(id)?.selectedOptions?.[0]?.textContent?.trim() || '';
  return {
    personName: $('person-name').value,
    personStyle: $('person-style').value,
    personGender: $('person-gender').value,
    level: $('level-input').value,
    hpFactor: $('hp-factor').value,
    powerFactor: $('power-factor').value,
    baseSpeed: $('base-speed').value,
    baseSpeedRoleDefaultsVersion: BASE_SPEED_DEFAULTS_VERSION,
    baseCritDefaultsVersion: BASE_CRIT_DEFAULTS_VERSION,
    characterBaseDefaultsVersion: CHARACTER_BASE_DEFAULTS_VERSION,
    speedPillsDefaultVersion: 1,
    baseCrit: $('base-crit').value,
    baseDodge: $('base-dodge').value,
    baseLifesteal: $('base-lifesteal').value,
    baseCritDamage: $('base-crit-damage').value,
    baseMitigation: $('base-mitigation').value,
    baseBlock: $('base-block').value,
    baseReflect: $('base-reflect').value,
    baseRecovery: $('base-recovery').value,
    achievementHp: $('achievement-hp').value,
    achievementAttack: $('achievement-attack').value,
    attackPillCount: $('attack-pill-count').value,
    smallRenAttackPercent: $('small-ren-attack-percent').value,
    largeRenAttackCount: $('large-ren-attack-count').value,
    learnedSMartialCount: $('learned-s-martial-count').value,
    martialBonusPercent: $('martial-bonus-percent').value,
    equipmentSlots: state.equipmentSlots.map((slot) => ({
      ...slot,
      secondary: { ...slot.secondary },
    })),
    weaponId: state.weaponId,
    weaponName: $('weapon-name').value,
    weaponMode: state.weaponMode,
    weaponForgeOption: state.weaponForgeOption,
    weaponAffixes: state.weaponAffixes.map((affix) => ({ ...affix })),
    martialId: $('martial-select').value,
    martialName: selectedText('martial-select'),
    speedPillsEnabled: $('speed-pills-enabled').checked,
    neigongId: $('neigong-select').value,
    neigongName: selectedText('neigong-select'),
    equipmentNames: state.equipmentSlots.map((slot) => slot?.name || '').filter(Boolean),
    neigongLevel: $('neigong-level').value,
    neigongHp: $('neigong-hp').value,
    neigongAttack: $('neigong-attack').value,
    neigongSpeed: $('neigong-speed').value,
    neigongMitigation: $('neigong-mitigation').value,
    neigongCrit: $('neigong-crit').value,
    neigongDodge: $('neigong-dodge').value,
    neigongLifesteal: $('neigong-lifesteal').value,
    neigongCritDamage: $('neigong-crit-damage').value,
    neigongBlock: $('neigong-block').value,
    neigongReflect: $('neigong-reflect').value,
    neigongRecovery: $('neigong-recovery').value,
    neigongStatsMode: innerStatsMode(),
    techniqueIds: selectedTechniqueIds(),
    techniqueSelectionConfigured: true,
    techniqueSelectionCustomized,
    techniqueHp: $('technique-hp').value,
    techniqueAttack: $('technique-attack').value,
    techniqueStatsMode: techniqueStatsMode(),
    formationId: $('formation-select').value,
    formationPosition: $('formation-position').value,
    pillsEnabled: $('pills-enabled').checked,
    attackPillsEnabled: $('attack-pills-enabled').checked,
    pillsRange: 30,
    smallRenEnabled: $('small-ren-enabled').checked,
    largeRenEnabled: $('large-ren-enabled').checked,
    damageTargetMitigation: $('damage-target-mitigation').value,
    damageFactor: $('damage-factor').value,
    damageCritAdjustment: $('damage-crit-adjustment').value,
    damageCritCustomized,
    damageFactorCustomized,
    haremBonusEnabled: $('harem-bonus-enabled').checked,
    haremBonusCustomized,
  };
}

function saveConfig() {
  if (!calculatorInitialized) return;
  const config = {
    ...currentConfig(),
    savedCards: comparisonSnapshots,
    comparisonPair,
    teams,
    activeView,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaveStatus('已自动保存到本机');
  } catch (error) {
    setSaveStatus('本机保存不可用');
  }
}

function isBuiltInExampleConfig(config) {
  const slots = Array.isArray(config?.equipmentSlots) ? config.equipmentSlots : [];
  const emptyEquipment = slots.length === 4 && slots.every((slot) => (
    !slot?.id && !String(slot?.name || '').trim()
    && Number(slot?.hp || 0) === 0 && Number(slot?.attack || 0) === 0
  ));
  return config?.personName === '主角'
    && String(config?.level) === '90'
    && String(config?.hpFactor) === '1'
    && String(config?.powerFactor) === '1'
    && emptyEquipment
    && !config?.whiteRabbitCharacter
    && config?.neigongId === 'old:3824'
    && String(config?.neigongLevel) === '9'
    && (config?.neigongStatsMode === 'auto' || config?.neigongStatsMode === 'manual')
    && String(config?.neigongHp) === '10'
    && String(config?.neigongAttack) === '10'
    && !String(config?.neigongExtra || '').trim()
    && !(Array.isArray(config?.techniqueIds) && config.techniqueIds.length)
    && !config?.techniqueId
    && String(config?.techniqueHp) === '5'
    && String(config?.techniqueAttack) === '3'
    && config?.pillsEnabled === true
    && String(config?.pillsRange) === '30';
}

function makeBlankConfig(config) {
  return {
    ...config,
    baseSpeed: '0',
    neigongId: '',
    neigongName: '',
    neigongHp: '0',
    neigongAttack: '0',
    neigongStatsMode: 'auto',
    techniqueIds: [],
    techniqueHp: '0',
    techniqueAttack: '0',
    techniqueStatsMode: 'manual',
    pillsEnabled: true,
    pillsRange: '30',
    speedPillsEnabled: false,
    smallRenEnabled: true,
    largeRenEnabled: true,
  };
}

function normalizeEquipment(value) {
  if (value && typeof value === 'object') {
    const rawId = value.id;
    const hasId = rawId !== null && rawId !== undefined && String(rawId) !== '';
    if (hasId) {
      if (isCustomEquipmentId(rawId)) return normalizeCustomEquipment(value, rawId);
      const rawItem = getEquipment(rawId);
      const item = rawItem?.source === 'white'
        ? rawItem
        : findWhiteEquipmentByName(value.name || equipmentName(rawItem));
      if (!item) return EMPTY_EQUIPMENT();
      const stats = equipmentStats(item);
      return {
        id: item.id,
        name: String(value.name || equipmentName(item)),
        hp: value.hp !== undefined ? numberValueFrom(value.hp) : stats.hp,
        attack: value.attack !== undefined ? numberValueFrom(value.attack) : stats.attack,
        hpFlat: value.hpFlat !== undefined ? numberValueFrom(value.hpFlat) : stats.hpFlat,
        attackFlat: value.attackFlat !== undefined ? numberValueFrom(value.attackFlat) : stats.attackFlat,
        secondary: value.secondary || stats.secondary,
        extra: String(value.extra || ''),
      };
    }
    return {
      id: null,
      name: String(value.name || ''),
      hp: Number(value.hp) || 0,
      attack: Number(value.attack) || 0,
      hpFlat: Number(value.hpFlat) || 0,
      attackFlat: Number(value.attackFlat) || 0,
      secondary: value.secondary || emptySecondaryStats(),
      extra: String(value.extra || ''),
    };
  }
  const rawItem = getEquipment(value);
  const item = rawItem?.source === 'white'
    ? rawItem
    : findWhiteEquipmentByName(equipmentName(rawItem));
  if (!item) return EMPTY_EQUIPMENT();
  const stats = equipmentStats(item);
  return {
    id: item.id,
    name: equipmentName(item),
    hp: stats.hp,
    attack: stats.attack,
    hpFlat: stats.hpFlat,
    attackFlat: stats.attackFlat,
    secondary: stats.secondary,
    extra: '',
  };
}

function isOldSampleEquipment(slots) {
  return slots.length === 4
    && slots[0]?.id === 5416
    && Number(slots[0]?.hp) === 12
    && Number(slots[0]?.attack) === 12
    && slots.slice(1).every((slot) => !equipmentSlotActive(slot));
}

function normalizeComparisonSnapshots(value) {
  if (!Array.isArray(value)) return [];
  const roleCounts = new Map();
  return value.slice(0, MAX_COMPARISON_SNAPSHOTS).map((snapshot) => {
    const roleName = String(snapshot?.roleName || '自定义角色');
    const level = Number(snapshot?.level) || 1;
    const roleCount = (roleCounts.get(roleName) || 0) + 1;
    roleCounts.set(roleName, roleCount);
    const hasStats = Boolean(snapshot?.stats && typeof snapshot.stats === 'object'
      && SECONDARY_KEYS.some((key) => Object.prototype.hasOwnProperty.call(snapshot.stats, key)));
    const name = normalizedName(snapshot?.name || `${roleName}${String(roleCount).padStart(3, '0')}`)
      || `${roleName}${String(roleCount).padStart(3, '0')}`.slice(0, MAX_CARD_NAME_LENGTH);
    return {
      hp: Number(snapshot?.hp) || 0,
      attack: Number(snapshot?.attack) || 0,
      roleName,
      level,
      cardId: String(snapshot?.cardId || snapshot?.id || localId('card')),
      name,
      config: snapshot?.config && typeof snapshot.config === 'object' ? snapshot.config : null,
      stats: Object.fromEntries(SECONDARY_KEYS.map((key) => [
        key,
        hasStats ? (Number(snapshot.stats[key]) || 0) : null,
      ])),
      statsAvailable: hasStats,
      label: name,
      martialName: String(snapshot?.martialName || snapshot?.config?.martialName || ''),
      innerName: String(snapshot?.innerName || snapshot?.config?.neigongName || ''),
      equipmentNames: Array.isArray(snapshot?.equipmentNames)
        ? snapshot.equipmentNames.map((item) => String(item)).filter(Boolean)
        : Array.isArray(snapshot?.config?.equipmentNames) ? snapshot.config.equipmentNames.map((item) => String(item)).filter(Boolean) : [],
    };
  });
}

function teamSlotRoleAllowed(roleName, slotIndex) {
  const isMainCharacter = String(roleName || '') === '主角';
  return slotIndex === 0 ? isMainCharacter : !isMainCharacter;
}

function normalizeTeams(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TEAMS).map((team, index) => ({
    id: String(team?.id || localId(`team${index}`)),
    name: normalizedName(team?.name || `配队${String(index + 1).padStart(3, '0')}`)
      || `配队${String(index + 1).padStart(3, '0')}`,
    slots: Array.from({ length: MAX_TEAM_SLOTS }, (_, slotIndex) => {
      const cardId = Array.isArray(team?.slots) ? team.slots[slotIndex] : null;
      const card = cardId ? comparisonSnapshots.find((snapshot) => snapshot.cardId === String(cardId)) : null;
      return card && teamSlotRoleAllowed(card.roleName, slotIndex) ? card.cardId : null;
    }),
    createdAt: Number(team?.createdAt) || Date.now(),
    updatedAt: Number(team?.updatedAt) || Date.now(),
  }));
}

function normalizeComparisonPair(value, snapshotCount = comparisonSnapshots.length) {
  if (snapshotCount < 2) return [0, 1];
  const savedPair = Array.isArray(value) ? value : [0, 1];
  const clampIndex = (candidate, fallback) => {
    const index = Number(candidate);
    return Number.isInteger(index) && index >= 0 && index < snapshotCount ? index : fallback;
  };
  const left = clampIndex(savedPair[0], 0);
  let right = clampIndex(savedPair[1], left === 0 ? 1 : 0);
  if (left === right) right = left === 0 ? 1 : 0;
  return [left, right];
}

function restoreConfig(sourceConfig = null) {
  let config;
  let storedKey;
  if (sourceConfig && typeof sourceConfig === 'object') {
    config = sourceConfig;
    storedKey = STORAGE_KEY;
  } else {
    try {
      storedKey = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]
        .find((key) => window.localStorage.getItem(key));
      const raw = storedKey ? window.localStorage.getItem(storedKey) : null;
      if (!raw) { setSaveStatus('首次使用，修改后自动保存'); return; }
      config = JSON.parse(raw);
    } catch (error) {
      setSaveStatus('保存数据无法读取');
      return;
    }
  }
  if (!config || typeof config !== 'object') return;
  if (config.baseSpeedRoleDefaultsVersion !== BASE_SPEED_DEFAULTS_VERSION
    && Number(config.baseSpeed) === 10) {
    config.baseSpeed = '0';
  }
  if (config.speedPillsDefaultVersion !== 1) config.speedPillsEnabled = true;
  if (storedKey !== STORAGE_KEY) {
    if (Number(config.baseCrit) === 1) config.baseCrit = '0';
    if (Number(config.baseDodge) === 1) config.baseDodge = '0';
    if (Number(config.baseLifesteal) === 1) config.baseLifesteal = '0';
    if (Number(config.baseCritDamage) === 200) config.baseCritDamage = '0';
  }
  if (config.baseCritDefaultsVersion !== BASE_CRIT_DEFAULTS_VERSION
    && (config.baseCrit === undefined || Number(config.baseCrit) === 0)) {
    config.baseCrit = '10';
  }
  if (storedKey !== STORAGE_KEY && Number(config.baseSpeed) === 64) config.baseSpeed = '0';
  if (isBuiltInExampleConfig(config)) config = makeBlankConfig(config);
  if (typeof config.personName === 'string') {
    const select = $('person-name');
    const personName = config.personName || '自定义角色';
    if (![...select.options].some((option) => option.value === personName)) {
      const option = document.createElement('option');
      option.value = personName;
      option.textContent = personName;
      select.appendChild(option);
    }
    select.value = personName;
    // A saved profile without explicit coefficients should still inherit its
    // character defaults before the remaining saved fields are restored.
    applyCharacterDefaults();
  }
  if (config.characterBaseDefaultsVersion !== CHARACTER_BASE_DEFAULTS_VERSION) {
    const profile = getCharacterProfile();
    const baseStats = { ...DEFAULT_CHARACTER_BASE_STATS, ...(profile?.base_stats || {}) };
    const configKeys = Object.fromEntries(Object.entries(CHARACTER_BASE_STAT_FIELDS).map(([key]) => [
      key,
      key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    ]));
    Object.entries(configKeys).forEach(([key, suffix]) => {
      const configKey = `base${suffix.split('-').map((part, index) => index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
      if (config[configKey] === undefined || Number(config[configKey]) === DEFAULT_CHARACTER_BASE_STATS[key]) {
        config[configKey] = baseStats[key];
      }
    });
    config.characterBaseDefaultsVersion = CHARACTER_BASE_DEFAULTS_VERSION;
  }
  const fieldMap = {
    personStyle: 'person-style', personGender: 'person-gender',
    level: 'level-input', hpFactor: 'hp-factor', powerFactor: 'power-factor',
    baseSpeed: 'base-speed', baseCrit: 'base-crit', baseDodge: 'base-dodge',
    baseLifesteal: 'base-lifesteal', baseCritDamage: 'base-crit-damage',
    baseMitigation: 'base-mitigation', baseBlock: 'base-block',
    baseReflect: 'base-reflect', baseRecovery: 'base-recovery',
    achievementHp: 'achievement-hp', achievementAttack: 'achievement-attack',
    neigongLevel: 'neigong-level', neigongHp: 'neigong-hp', neigongAttack: 'neigong-attack',
    neigongSpeed: 'neigong-speed', neigongMitigation: 'neigong-mitigation',
    neigongCrit: 'neigong-crit', neigongDodge: 'neigong-dodge',
    neigongLifesteal: 'neigong-lifesteal', neigongCritDamage: 'neigong-crit-damage',
    neigongBlock: 'neigong-block', neigongReflect: 'neigong-reflect', neigongRecovery: 'neigong-recovery',
    techniqueHp: 'technique-hp', techniqueAttack: 'technique-attack',
    attackPillCount: 'attack-pill-count', smallRenAttackPercent: 'small-ren-attack-percent',
    largeRenAttackCount: 'large-ren-attack-count',
    learnedSMartialCount: 'learned-s-martial-count',
    martialBonusPercent: 'martial-bonus-percent',
    damageTargetMitigation: 'damage-target-mitigation',
    damageFactor: 'damage-factor',
    damageCritAdjustment: 'damage-crit-adjustment',
    formationPosition: 'formation-position',
  };
  Object.entries(fieldMap).forEach(([key, id]) => { if (config[key] !== undefined) $(id).value = config[key]; });
  damageCritCustomized = config.damageCritCustomized === true;
  damageFactorCustomized = config.damageFactorCustomized === true;
  haremBonusCustomized = config.haremBonusCustomized === true;
  if (typeof config.haremBonusEnabled === 'boolean') $('harem-bonus-enabled').checked = config.haremBonusEnabled;
  applyCharacterDefaults({ resetBaseStats: false });
  populateMartialArts();
  populateNeigong();
  if (typeof config.pillsEnabled === 'boolean') $('pills-enabled').checked = config.pillsEnabled;
  if (typeof config.attackPillsEnabled === 'boolean') $('attack-pills-enabled').checked = config.attackPillsEnabled;
  if (typeof config.speedPillsEnabled === 'boolean') $('speed-pills-enabled').checked = config.speedPillsEnabled;
  if (typeof config.smallRenEnabled === 'boolean') $('small-ren-enabled').checked = config.smallRenEnabled;
  if (typeof config.largeRenEnabled === 'boolean') $('large-ren-enabled').checked = config.largeRenEnabled;
  if (config.formationId !== undefined) $('formation-select').value = String(config.formationId);
  comparisonSnapshots = normalizeComparisonSnapshots(
    Array.isArray(config.savedCards) ? config.savedCards : config.comparisonSnapshots,
  );
  comparisonPair = normalizeComparisonPair(config.comparisonPair);
  teams = normalizeTeams(config.teams);
  if (Array.isArray(config.equipmentSlots)) {
    state.equipmentSlots = config.equipmentSlots.slice(0, 4).map(normalizeEquipment);
    while (state.equipmentSlots.length < 4) state.equipmentSlots.push(EMPTY_EQUIPMENT());
    if (isOldSampleEquipment(state.equipmentSlots)) {
      state.equipmentSlots = [EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT()];
    }
  }
  if (config.weaponId !== undefined) {
    const item = getWhiteEquipment(config.weaponId);
    state.weaponId = item && isWeapon(item) ? String(config.weaponId) : '';
  }
  if (config.weaponName !== undefined) $('weapon-name').value = String(config.weaponName);
  if (config.weaponMode === 'builtin' || config.weaponMode === 'custom' || config.weaponMode === 'empty') {
    state.weaponMode = config.weaponMode;
  } else {
    state.weaponMode = state.weaponId ? 'builtin'
      : (String(config.weaponName || '').trim() || Array.isArray(config.weaponAffixes)
        && config.weaponAffixes.some((affix) => Number(affix?.value)) ? 'custom' : 'empty');
  }
  if (config.weaponForgeOption !== undefined) state.weaponForgeOption = String(config.weaponForgeOption || '');
  if (Array.isArray(config.weaponAffixes)) {
    state.weaponAffixes = config.weaponAffixes.slice(0, 3).map((affix) => ({
      key: WEAPON_ATTRIBUTE_OPTIONS.some((item) => item.key === affix?.key) ? affix.key : '',
      mode: affix?.mode === 'percent' ? 'percent' : 'flat',
      value: Number(affix?.value) || 0,
    }));
    while (state.weaponAffixes.length < 3) state.weaponAffixes.push(EMPTY_WEAPON_AFFIX());
  }
  if (config.martialId !== undefined) {
    const value = String(config.martialId);
    if (value.startsWith('wr-skill:')) {
      $('martial-select').value = value;
    } else if (value.startsWith('old-skill:')) {
      const item = state.data?.skill?.[value.slice(10)];
      const index = findWhiteMartialIndexByName(item?.nick || item?.name);
      $('martial-select').value = index >= 0 ? `wr-skill:${index}` : '';
    } else {
      $('martial-select').value = '';
    }
  }
  if (config.neigongId !== undefined) {
    const value = String(config.neigongId);
    if (value === '' || value.startsWith('wr:')) {
      $('neigong-select').value = value;
    } else {
      const item = state.data?.neiGong?.[value.replace(/^old:/, '')];
      const index = findWhiteInnerIndexByName(item?.nick || item?.name);
      $('neigong-select').value = index >= 0 ? `wr:${index}` : '';
    }
  }
  let techniqueIds = Array.isArray(config.techniqueIds) ? config.techniqueIds : [];
  const legacyTechniqueSelection = !Array.isArray(config.techniqueIds)
    && config.techniqueId !== undefined && String(config.techniqueId) !== '';
  if (!techniqueIds.length && legacyTechniqueSelection) {
    const oldId = String(config.techniqueId);
    const oldTechnique = state.whiteRabbit?.techniques?.[Number(oldId)];
    techniqueIds = oldTechnique?.group === 'wolong' ? [`wolong:${oldId}:0`] : [oldId];
  }
  if (legacyTechniqueSelection) {
    $('technique-hp').value = 0;
    $('technique-attack').value = 0;
  }
  if (typeof config.largeRenEnabled !== 'boolean') {
    techniqueIds = techniqueIds.filter((id) => String(id) !== '25');
  }
  const hasSavedTechniqueSelection = config.techniqueSelectionCustomized === true
    && (config.techniqueSelectionConfigured === true || techniqueIds.length > 0 || legacyTechniqueSelection);
  setTechniqueSelections(
    hasSavedTechniqueSelection ? techniqueIds : defaultTechniqueIds(),
    { customized: hasSavedTechniqueSelection },
  );
  setTechniqueStatsMode(config.techniqueStatsMode === 'auto' ? 'auto' : 'manual');
  renderFormationControls();
  renderTechniqueScope();
  setInnerStatsMode(config.neigongStatsMode === 'manual' && getSelectedInner()?.source === 'custom' ? 'manual' : 'auto');
  renderInnerEditor();
  renderComparison();
  renderSavedCards();
  renderTeams();
  switchView(config.activeView || 'calculator', { persist: false });
  setSaveStatus('已加载本机配置');
}

function populateNeigong() {
  const select = $('neigong-select');
  const previousValue = select.value;
  select.innerHTML = '<option value="">无内功（0%）</option><option value="custom">自定义内功</option>';
  if (state.whiteRabbit?.inner_skills?.length) {
    const whiteGroup = document.createElement('optgroup');
    whiteGroup.label = '白兔内功';
    state.whiteRabbit.inner_skills.forEach((skill, index) => {
      if (!String(skill.rank || '').trim() || !innerScopeEligible(skill)) return;
      const option = document.createElement('option');
      option.value = `wr:${index}`;
      const stats = autoInnerStats({ source: 'white', item: skill });
      const summary = innerStatsSummary(stats);
      option.textContent = `${skill.name} · ${skill.rank}${summary ? ` · ${summary}` : ''}`;
      whiteGroup.appendChild(option);
    });
    select.appendChild(whiteGroup);
  }
  select.value = [...select.options].some((option) => option.value === previousValue)
    ? previousValue
    : '';
  select.disabled = false;
}

function populateMartialArts() {
  const select = $('martial-select');
  const previousValue = select.value;
  select.innerHTML = '<option value="">无武学（+0速度）</option>';
  const white = (state.whiteRabbit?.martial_arts || [])
    .map((skill, index) => ({ skill, index }))
    .filter(({ skill }) => String(skill.rank || '').trim()
      && Number.isFinite(Number(skill.speed))
      && martialStyleEligible(skill));
  if (white.length) {
    const groups = new Map();
    white.forEach(({ skill, index }) => {
      const style = martialStyle(skill) || '其他';
      if (!groups.has(style)) groups.set(style, []);
      groups.get(style).push({ skill, index });
    });
    groups.forEach((items, style) => {
      const group = document.createElement('optgroup');
      group.label = `白兔${style}武学`;
      items.forEach(({ skill, index }) => {
        const option = document.createElement('option');
        option.value = `wr-skill:${index}`;
        option.textContent = `${skill.name || '未命名武学'} · ${displayMartialRank(skill.rank)} · 威力 ${Number(skill.power) || 0} · 速度 ${Number(skill.speed)} · ${martialRange(skill)}`;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
  }
  const availableValues = new Set([...select.options].map((option) => option.value));
  select.value = availableValues.has(previousValue) ? previousValue : '';
  select.disabled = false;
}

function filteredEquipment() {
  const white = state.whiteRabbit?.equipment || [];
  return white.filter((item) => !isWeapon(item) && isSEquipment(item));
}
function equipmentCategory(item) {
  if (item?.source === 'white') {
    if (item?.slot) return item.slot;
    const match = /^wr-eq-(\d+)$/.exec(String(item.id));
    if (!match) return '';
    const index = Number(match[1]);
    if (index < 8) return 'armor';
    if (index < 20) return 'ring';
    return 'wrist';
  }
  return ({ 5: 'armor', 6: 'ring', 7: 'wrist' })[Number(item?.type)] || '';
}
function equipmentCategoryForSlot(slotIndex) {
  return ({ 1: 'armor', 2: 'ring', 3: 'wrist' })[slotIndex] || '';
}
function filteredEquipmentForSlot(slotIndex) {
  const category = equipmentCategoryForSlot(slotIndex);
  return filteredEquipment().filter((item) => equipmentCategory(item) === category);
}
function renderCustomEquipmentEditor(slotIndex, slot) {
  const editor = $(`custom-equipment-editor-${slotIndex}`);
  if (!editor) return;
  const active = isCustomEquipmentId(slot?.id) && String(slot.id) === customEquipmentId(slotIndex);
  editor.hidden = !active;
  if (!active) {
    editor.innerHTML = '';
    return;
  }
  const basicFields = [
    { key: 'name', label: '名称', type: 'text', value: slot.name, inputmode: 'text' },
    { key: 'hp', label: '生命 %', step: '0.1', value: slot.hp, inputmode: 'decimal' },
    { key: 'attack', label: '攻击 %', step: '0.1', value: slot.attack, inputmode: 'decimal' },
    { key: 'hpFlat', label: '固定生命', step: '1', value: slot.hpFlat, inputmode: 'numeric' },
    { key: 'attackFlat', label: '固定攻击', step: '1', value: slot.attackFlat, inputmode: 'numeric' },
  ];
  const renderField = (field) => `<label class="field${field.type === 'text' ? ' field-wide' : ''}"><span>${field.label}</span><input type="${field.type || 'number'}" ${field.type === 'text' ? '' : 'min="-100"'} step="${field.step || '0.1'}" value="${escapeHtml(field.value)}" inputmode="${field.inputmode}" data-custom-equipment-slot="${slotIndex}" data-custom-equipment-field="${field.key}"></label>`;
  const secondaryFields = SECONDARY_STAT_DEFS.map((definition) => {
    const isNumber = definition.format === 'number';
    const value = slot.secondary?.[definition.key] || 0;
    return `<label class="field"><span>${definition.label}${isNumber ? '' : ' %'}</span><input type="number" min="-100" step="${isNumber ? '1' : '0.1'}" value="${value}" inputmode="${isNumber ? 'numeric' : 'decimal'}" data-custom-equipment-slot="${slotIndex}" data-custom-equipment-secondary="${definition.key}"></label>`;
  }).join('');
  editor.innerHTML = `
    <div class="custom-equipment-heading"><strong>自定义装备属性</strong><span>只对当前部位生效</span></div>
    <div class="custom-equipment-grid">${basicFields.map(renderField).join('')}</div>
    <details class="custom-equipment-more"><summary>其他面板属性</summary><div class="custom-equipment-grid">${secondaryFields}</div></details>`;
}
function renderEquipmentSlots() {
  state.equipmentSlots = state.equipmentSlots.map((slot) => (
    slot?.id && !isCustomEquipmentId(slot.id) && !getEquipment(slot.id) ? EMPTY_EQUIPMENT() : slot
  ));
  state.equipmentSlots.slice(1, 4).forEach((rawSlot, visibleIndex) => {
    const slotIndex = visibleIndex + 1;
    const category = equipmentCategoryForSlot(slotIndex);
    const customId = customEquipmentId(slotIndex);
    const currentItem = rawSlot?.id && !isCustomEquipmentId(rawSlot.id) ? getEquipment(rawSlot.id) : null;
    const current = String(rawSlot?.id) === customId
      ? normalizeCustomEquipment(rawSlot, customId)
      : currentItem && equipmentCategory(currentItem) === category ? rawSlot : EMPTY_EQUIPMENT();
    state.equipmentSlots[slotIndex] = current;
    const select = $(`equipment-slot-${slotIndex}`);
    const visibleItems = filteredEquipmentForSlot(slotIndex);
    if (current.id && !visibleItems.some((item) => String(item.id) === String(current.id))) {
      const currentItem = getEquipment(current.id);
      if (currentItem) visibleItems.unshift(currentItem);
    }
    select.innerHTML = '<option value="">未选择</option>';
    visibleItems.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id);
      const source = item.source === 'white' ? '白兔' : '原版';
      const unique = item.unique ? ' · 唯一' : '';
      option.textContent = `${equipmentName(item)} · ${source}${unique} · ${equipmentSummary(item)}`;
      option.title = item.access ? `获取：${item.access} · 生效：${item.scope || '佩戴者'}` : '';
      select.appendChild(option);
    });
    const customOption = document.createElement('option');
    customOption.value = customId;
    customOption.textContent = '自定义装备';
    select.appendChild(customOption);
    select.value = current.id ? String(current.id) : '';
    renderCustomEquipmentEditor(slotIndex, current);
  });
  const selectedCount = state.equipmentSlots.slice(1).filter(equipmentSlotActive).length + (weaponActive() ? 1 : 0);
  $('equipment-count').textContent = `已装备 ${selectedCount}/4`;
  const hp = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.hp || 0), 0);
  const attack = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.attack || 0), 0);
  const hpFlat = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.hpFlat || 0), 0);
  const attackFlat = state.equipmentSlots.reduce((sum, slot) => sum + Number(slot.attackFlat || 0), 0);
  $('equipment-breakdown').textContent = `装备生命 +${formatPercent(hp)}${hpFlat ? ` · 固定 +${formatNumber(hpFlat)}` : ''} · 装备攻击 +${formatPercent(attack)}${attackFlat ? ` · 固定 +${formatNumber(attackFlat)}` : ''}`;
}

function applyInnerSelection() {
  const selection = getSelectedInner();
  renderInnerEditor();
  if (!selection) {
    setInnerStatsMode('auto');
    INNER_MANUAL_FIELD_IDS.forEach((id) => { $(id).value = 0; });
  } else if (selection.source === 'white') {
    setInnerStatsMode('auto');
    syncAutoInnerStats();
  } else if (selection.source === 'game') {
    setInnerStatsMode('auto');
    syncAutoInnerStats();
  } else {
    setInnerStatsMode('manual');
  }
  calculate();
}
function populateFormationControls() {
  const formationSelect = $('formation-select');
  formationSelect.innerHTML = '';
  FORMATION_OPTIONS.forEach((formation) => {
    const option = document.createElement('option');
    option.value = formation.key;
    option.textContent = formation.label;
    formationSelect.appendChild(option);
  });
  const positionSelect = $('formation-position');
  positionSelect.innerHTML = '';
  FORMATION_POSITION_OPTIONS.forEach((position) => {
    const option = document.createElement('option');
    option.value = position.key;
    option.textContent = position.label;
    positionSelect.appendChild(option);
  });
  formationSelect.value = '';
  positionSelect.value = '1';
  renderFormationControls();
}
function renderFormationControls() {
  const formation = $('formation-select').value;
  const isMain = ($('person-name').value.trim() || '自定义角色') === '主角';
  const positionSelect = $('formation-position');
  if (isMain) {
    positionSelect.value = '1';
  } else {
    const position = Math.max(2, Math.min(9, Math.round(Number(positionSelect.value) || 2)));
    positionSelect.value = String(position);
  }
  [...positionSelect.options].forEach((option) => {
    option.disabled = !isMain && option.value === '1';
  });
  positionSelect.disabled = !formation || isMain;
  $('formation-position-field').classList.toggle('is-muted', !formation || isMain);
  $('formation-hint').textContent = !formation
    ? '当前不计入阵法'
    : isMain
      ? `${formation === 'jiugong' ? '九宫八卦阵' : '八枢汇极阵'} · 主角自动使用 1 号位`
      : `${formation === 'jiugong' ? '九宫八卦阵' : '八枢汇极阵'} · 当前选择 ${positionSelect.value} 号位`;
}
function populate() {
  populateCharacterPresets();
  populateNeigong();
  populateMartialArts();
  populateTechniques();
  populateFormationControls();
  populateWeaponAffixes();
  renderEquipmentSlots();
}

function weaponAffixTotals() {
  const totals = {
    hpFlat: 0,
    hpPercent: 0,
    attackFlat: 0,
    attackPercent: 0,
    secondary: emptySecondaryStats(),
  };
  const selectedWeapon = getWhiteEquipment(state.weaponId);
  if (selectedWeapon && isWeapon(selectedWeapon)) {
    const builtIn = equipmentStats(selectedWeapon);
    totals.hpFlat += builtIn.hpFlat;
    totals.hpPercent += builtIn.hp;
    totals.attackFlat += calculatorWeaponAttackFlat(selectedWeapon);
    totals.attackPercent += builtIn.attack;
    addSecondaryStats(totals.secondary, builtIn.secondary);
  }
  const forgeAffix = selectedWeaponForgeAffix(selectedWeapon);
  if (forgeAffix) {
    const suffix = forgeAffix.mode === 'percent' ? 'Percent' : 'Flat';
    if (forgeAffix.key === 'hp') totals[`hp${suffix}`] += forgeAffix.value;
    else if (forgeAffix.key === 'attack') totals[`attack${suffix}`] += forgeAffix.value;
    else if (SECONDARY_KEYS.includes(forgeAffix.key)) totals.secondary[forgeAffix.key] += forgeAffix.value;
  }
  if (!selectedWeapon) {
    state.weaponAffixes.forEach((affix) => {
      const value = Number(affix.value) || 0;
      if (!affix.key || !value) return;
      const suffix = affix.mode === 'percent' ? 'Percent' : 'Flat';
      if (affix.key === 'hp') totals[`hp${suffix}`] += value;
      else if (affix.key === 'attack') totals[`attack${suffix}`] += value;
      else if (SECONDARY_KEYS.includes(affix.key)) totals.secondary[affix.key] += value;
    });
  }
  return totals;
}

function clearGeneratedResult() {
  resultGenerated = false;
  currentResult = null;
  activeComparisonIndex = null;
  renderDamagePreview(null);
  $('final-hp').textContent = '--';
  $('final-attack').textContent = '--';
  $('hp-detail').textContent = '等待确认生成';
  $('attack-detail').textContent = '等待确认生成';
  $('result-person').textContent = '--';
  $('result-level').textContent = '等级 --';
  renderCharacterFactorLine();
  SECONDARY_KEYS.forEach((key) => {
    const domKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    $(`final-${domKey}`).textContent = '--';
  });
}

function renderCharacterFactorLine() {
  const hpFactor = numberValue('hp-factor', 1);
  const powerFactor = numberValue('power-factor', 1);
  $('factor-line').textContent = `生命系数 ${hpFactor} · 攻击系数 ${powerFactor}`;
}

function calculate({ commit = false } = {}) {
  if (!state.data) return;
  refreshSelectProxies();
  setError('');
  if (!commit) {
    if (resultGenerated || currentResult) clearGeneratedResult();
    saveConfig();
    return null;
  }
  const level = Math.max(1, Math.min(90, Math.round(numberValue('level-input', 1))));
  const roleName = $('person-name').value.trim() || '自定义角色';
  const hpFactor = numberValue('hp-factor', 1);
  const powerFactor = numberValue('power-factor', 1);
  const achievementHp = numberValue('achievement-hp');
  const achievementAttack = numberValue('achievement-attack');
  const baseHpRaw = Number(state.data.personHp[level]) * hpFactor;
  const baseHp = trunc(baseHpRaw);
  const baseAttackRaw = Number(state.data.personPower[level]) * powerFactor;
  const baseAttack = trunc(baseAttackRaw);
  const activeEquipment = state.equipmentSlots.filter(equipmentSlotActive);
  const equipmentHp = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.hp), 0);
  const equipmentAttack = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.attack), 0);
  const equipmentHpFlat = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.hpFlat), 0);
  const equipmentAttackFlat = activeEquipment.reduce((sum, slot) => sum + numberValueFrom(slot.attackFlat), 0);
  const inner = getSelectedInner();
  const innerDetails = autoInnerStats(inner);
  const selectedMartial = getSelectedMartial();
  const haremBonusActive = renderHaremBonusControl(selectedMartial?.item, inner);
  const autoStats = innerStatsMode() === 'auto' ? innerDetails : null;
  const neigongHp = inner ? (autoStats?.hp ?? numberValue('neigong-hp')) : 0;
  const neigongAttack = inner ? (autoStats?.attack ?? numberValue('neigong-attack')) : 0;
  const selectedTechniqueStats = techniqueTotals();
  const techniqueHp = selectedTechniqueStats.hp;
  const largeRenHpSupplement = numberValue('technique-hp');
  const largeRenAttackSupplement = numberValue('technique-attack');
  const techniqueAttack = selectedTechniqueStats.attack;
  const activeFormation = formationStats();
  const weaponTotals = weaponAffixTotals();
  const secondaryStats = {
    speed: numberValue('base-speed', 0) + martialSpeed(selectedMartial),
    mitigation: numberValue('base-mitigation'),
    crit: numberValue('base-crit', 10),
    dodge: numberValue('base-dodge', 0),
    lifesteal: numberValue('base-lifesteal', 0),
    critDamage: numberValue('base-crit-damage', 0),
    block: numberValue('base-block'),
    reflect: numberValue('base-reflect'),
    recovery: numberValue('base-recovery'),
  };
  if (selectedMartial?.item) {
    secondaryStats.crit += Number(selectedMartial.item.crit_percent) || 0;
  }
  if ($('speed-pills-enabled').checked) secondaryStats.speed += 30;
  const innerSecondary = innerDetails?.secondary;
  if (innerSecondary) addSecondaryStats(secondaryStats, innerSecondary);
  addSecondaryStats(secondaryStats, selectedTechniqueStats.secondary);
  addSecondaryStats(secondaryStats, activeFormation.secondary);
  addSecondaryStats(secondaryStats, weaponTotals.secondary);
  activeEquipment.forEach((slot) => {
    addSecondaryStats(secondaryStats, slot.secondary || secondaryStatsFromEquipment(getRawEquipment(slot.id)));
  });
  const reflectToRecoveryRatio = Number(getCharacterProfile(roleName)?.reflect_to_recovery_ratio) || 0;
  if (reflectToRecoveryRatio) {
    secondaryStats.recovery += secondaryStats.reflect * reflectToRecoveryRatio;
  }
  const pillsEnabled = $('pills-enabled').checked;
  const pillCount = 30;
  const pills = pillsEnabled ? pillCount : 0;
  const pillHp = pills * 2;
  const smallRenEnabled = $('small-ren-enabled').checked;
  const smallRenHp = smallRenEnabled ? 20 : 0;
  const smallRenAttack = smallRenEnabled ? numberValue('small-ren-attack-percent', 10) : 0;
  const largeRenEnabled = $('large-ren-enabled').checked;
  // 大任督的气血百分比只乘基础成长生命，不乘装备固定血量或成就固定血量。
  const largeRenHp = largeRenEnabled ? 110 : 0;
  const largeRenAttackCount = largeRenEnabled ? Math.max(0, numberValue('large-ren-attack-count', 10)) : 0;
  const largeRenSpeed = largeRenEnabled ? 8 : 0;
  secondaryStats.speed += largeRenSpeed;
  const haremSpeedMultiplier = haremBonusActive ? 1.1 : 1;
  secondaryStats.speed = trunc(secondaryStats.speed * haremSpeedMultiplier);
  // Blood pills and ordinary life percentages are calculated first. Formation
  // life is a separate multiplier on the resulting life value.
  const bloodPillBaseHp = baseHpRaw * (100 + pillHp) / 100;
  const postPillHpPercent = equipmentHp + techniqueHp + neigongHp + smallRenHp
    + weaponTotals.hpPercent;
  const largeRenHpBonus = largeRenEnabled
    ? baseHpRaw * (largeRenHp + largeRenHpSupplement) / 100
    : 0;
  const hpBeforeFormation = bloodPillBaseHp * (100 + postPillHpPercent) / 100 + largeRenHpBonus;
  const formationHpMultiplier = 1 + activeFormation.hp / 100;
  const finalHpRaw = hpBeforeFormation * formationHpMultiplier;
  const hpPercent = baseHpRaw ? (finalHpRaw / baseHpRaw - 1) * 100 : 0;
  const hpWithFixedBonuses = Math.round(hpBeforeFormation) + trunc(achievementHp) + trunc(weaponTotals.hpFlat) + trunc(equipmentHpFlat);
  const finalHp = Math.round(hpWithFixedBonuses * formationHpMultiplier);
  const attackPillsEnabled = $('attack-pills-enabled').checked;
  const attackPillCount = attackPillsEnabled ? Math.max(0, Math.min(30, numberValue('attack-pill-count', 30))) : 0;
  const attackPillMultiplier = 1 + attackPillCount / 100;
  const selectedMartialStyle = martialStyle(selectedMartial?.item);
  const martialPower = Number(selectedMartial?.item?.power) || 0;
  const martialTechniqueBonus = martialTechniqueBonusPercent(selectedMartial?.item);
  const selectedStylePower = selectedMartialStyle
    ? (innerDetails?.stylePower?.[selectedMartialStyle] || 0) + (selectedTechniqueStats.stylePower?.[selectedMartialStyle] || 0) + martialTechniqueBonus
    : 0;
  const martialAttackBonus = Number(innerDetails?.martialAttackPercent) || 0;
  const martialBonusPercent = numberValue('martial-bonus-percent');
  // 技艺攻击百分比（包括朱雀之力）同时作用于基础攻击项和武学项。
  const baseAttackPercentMultiplier = 1 + (
    neigongAttack + techniqueAttack + selectedStylePower
  ) / 100;
  const baseAttackDetailTerm = baseAttackRaw * baseAttackPercentMultiplier;
  const baseAttackTerm = baseAttackDetailTerm * attackPillMultiplier;
  const martialPowerTerm = martialPower * (
    1 + (neigongAttack + smallRenAttack + techniqueAttack + selectedStylePower + martialBonusPercent + martialAttackBonus) / 100
  );
  const largeRenAttackTerm = largeRenEnabled
    ? baseAttackRaw * (0.1 * largeRenAttackCount + largeRenAttackSupplement / 100)
    : 0;
  const equipmentPercentTerm = (baseAttackRaw * attackPillMultiplier + martialPower)
    * (equipmentAttack + weaponTotals.attackPercent) / 100;
  const attackBeforeSMultiplier = baseAttackTerm + martialPowerTerm + largeRenAttackTerm
    + equipmentAttackFlat + weaponTotals.attackFlat + equipmentPercentTerm;
  const learnedSMartialCount = Math.max(0, numberValue('learned-s-martial-count', 5));
  const sMartialMultiplier = 1 + learnedSMartialCount * 0.05;
  const formationAttackMultiplier = 1 + activeFormation.attack / 100;
  const finalAttackBeforeHarem = trunc(attackBeforeSMultiplier * sMartialMultiplier) + trunc(achievementAttack);
  const haremAttackMultiplier = haremBonusActive ? 1.25 : 1;
  const finalAttack = trunc(trunc(finalAttackBeforeHarem * haremAttackMultiplier) * formationAttackMultiplier);
  if (!damageFactorCustomized) $('damage-factor').value = martialDamageFactor(selectedMartial?.item);
  const weaponWhiteAttack = weaponTotals.attackFlat;
  const damagePreview = calculateDamagePreview({
    attack: finalAttack,
    baseAttackRaw,
    weaponWhiteAttack,
    maxHp: finalHp,
    martial: selectedMartial?.item,
    stats: secondaryStats,
    damageFactor: numberValue('damage-factor', 1),
    targetMitigation: numberValue('damage-target-mitigation', 0),
    critDamageValue: damageCritCustomized ? numberValue('damage-crit-adjustment', 0) : null,
    formationDamagePercent: activeFormation.damage,
    haremAttackMultiplier,
  });
  // 回复按 APK 面板口径：玄武的基础回复量也要乘内功生命加成。
  const recoveryBase = baseHpRaw * (100 + neigongHp) / 100;
  const recoveryValue = trunc(
    recoveryBase * secondaryStats.recovery / 100
      + recoveryBase * selectedTechniqueStats.recoveryBasePercent / 100,
  );
  $('final-hp').textContent = formatNumber(finalHp);
  $('final-attack').textContent = formatNumber(finalAttack);
  renderDamagePreview(damagePreview);
  $('hp-detail').textContent = `基础 ${formatNumber(baseHp)} · 百分比 ${formatPercent(hpPercent)} · 成就 +${formatNumber(achievementHp)}`;
  $('attack-detail').textContent = `基础项 ${formatNumber(trunc(baseAttackDetailTerm))} · 武学项 ${formatNumber(martialPower)} · S武学 ${formatPercent(learnedSMartialCount * 5)} · 成就 +${formatNumber(achievementAttack)}${haremBonusActive ? ' · 后宫×1.25' : ''}`;
  SECONDARY_KEYS.forEach((key) => {
    const domKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const value = key === 'critDamage' && damagePreview
      ? formatPercent(damagePreview.generatedCritDamagePercent)
      : key === 'recovery'
        ? formatNumber(recoveryValue)
        : formatSecondaryValue(key, secondaryStats[key]);
    $(`final-${domKey}`).textContent = value;
  });
  $('result-person').textContent = roleName;
  $('result-level').textContent = `等级 ${level}`;
  renderCharacterFactorLine();
  $('equipment-breakdown').textContent = `装备生命 +${formatPercent(equipmentHp)}${equipmentHpFlat ? ` · 固定 +${formatNumber(equipmentHpFlat)}` : ''} · 装备攻击 +${formatPercent(equipmentAttack)}${equipmentAttackFlat ? ` · 固定 +${formatNumber(equipmentAttackFlat)}` : ''}`;
  currentResult = {
    hp: finalHp,
    attack: finalAttack,
    roleName,
    level,
    stats: Object.fromEntries(SECONDARY_KEYS.map((key) => [
      key,
      key === 'recovery'
        ? recoveryValue
        : key === 'critDamage' && damagePreview
          ? damagePreview.generatedCritDamagePercent
          : secondaryStats[key],
    ])),
    damage: damagePreview,
  };
  resultGenerated = true;
  saveConfig();
  return currentResult;
}

function comparisonSnapshot() {
  if (!currentResult || !resultGenerated) return null;
  const config = currentConfig();
  return {
    ...currentResult,
    config,
    stats: { ...currentResult.stats },
    statsAvailable: true,
    cardId: localId('card'),
    name: defaultCardName(currentResult.roleName),
    label: defaultCardName(currentResult.roleName),
    martialName: config.martialName,
    innerName: config.neigongName,
    equipmentNames: config.equipmentNames,
  };
}

function restoreSnapshotConfiguration(snapshot) {
  const snapshotConfig = snapshot?.config && typeof snapshot.config === 'object'
    ? snapshot.config
    : {
      // Older snapshots only contain result values. Restore their role and
      // level at minimum while keeping the comparison record usable.
      personName: snapshot?.roleName || '自定义角色',
      level: String(snapshot?.level || 1),
    };
  restoreConfig({
    ...snapshotConfig,
    savedCards: comparisonSnapshots,
    comparisonPair,
    teams,
  });
  calculate({ commit: true });
  return true;
}

function comparisonCode(index) {
  return String(index + 1).padStart(3, '0');
}

function nextCardName(roleName) {
  let sequence = characterCardCount(roleName) + 1;
  let candidate = `${roleName}${String(sequence).padStart(3, '0')}`.slice(0, MAX_CARD_NAME_LENGTH);
  while (isDuplicateCardName(candidate)) {
    sequence += 1;
    candidate = `${roleName}${String(sequence).padStart(3, '0')}`.slice(0, MAX_CARD_NAME_LENGTH);
  }
  return candidate;
}

function openNameDialog({ title, label = '名称', defaultValue = '', kind = 'card', confirmLabel = '保存', excludeId = '' }) {
  return new Promise((resolve) => {
    pendingNameDialog = { resolve, kind, excludeId };
    $('name-modal-title').textContent = title;
    $('name-modal-label').textContent = label;
    $('name-modal-confirm').textContent = confirmLabel;
    $('name-modal-input').value = defaultValue;
    $('name-modal-error').textContent = '';
    $('name-modal').hidden = false;
    requestAnimationFrame(() => {
      $('name-modal-input').focus();
      $('name-modal-input').select();
    });
  });
}

function closeNameDialog(value = null) {
  const request = pendingNameDialog;
  pendingNameDialog = null;
  $('name-modal').hidden = true;
  if (request) request.resolve(value);
}

function openConfirmationDialog(message, onConfirm) {
  pendingConfirmation = onConfirm;
  $('confirm-modal-message').textContent = message;
  $('confirm-modal').hidden = false;
  requestAnimationFrame(() => $('confirm-modal-confirm').focus());
}

function closeConfirmationDialog() {
  pendingConfirmation = null;
  $('confirm-modal').hidden = true;
}

function confirmPendingAction() {
  const action = pendingConfirmation;
  closeConfirmationDialog();
  if (action) action();
}

function validateNameDialog() {
  const value = normalizedName($('name-modal-input').value);
  const error = $('name-modal-error');
  if (!value) {
    error.textContent = '名称不能为空';
    return null;
  }
  const duplicate = pendingNameDialog?.kind === 'team'
    ? teams.some((team) => team.id !== pendingNameDialog.excludeId && team.name.toLocaleLowerCase() === value.toLocaleLowerCase())
    : isDuplicateCardName(value);
  if (duplicate) {
    error.textContent = '名称已存在，请换一个名称';
    return null;
  }
  return value;
}

function snapshotDisplayText(snapshot) {
  const config = snapshot?.config || {};
  return [
    snapshot?.martialName || config.martialName,
    snapshot?.innerName || config.neigongName,
    ...(snapshot?.equipmentNames || config.equipmentNames || []),
  ].filter((value) => value && !/^无武学|^无内功/.test(String(value))).join(' · ');
}

function saveCardSnapshot(snapshot, name) {
  if (!snapshot || comparisonSnapshots.length >= MAX_COMPARISON_SNAPSHOTS) return -1;
  snapshot.name = name;
  snapshot.label = name;
  comparisonSnapshots.push(snapshot);
  const index = comparisonSnapshots.length - 1;
  activeComparisonIndex = index;
  saveConfig();
  renderComparison();
  renderSavedCards();
  renderTeams();
  return index;
}

async function saveCurrentCard() {
  if (comparisonSnapshots.length >= MAX_COMPARISON_SNAPSHOTS) {
    setSaveStatus('数据卡片已达到 300 张上限');
    return -1;
  }
  calculate({ commit: true });
  const snapshot = comparisonSnapshot();
  if (!snapshot) return -1;
  const name = await openNameDialog({
    title: '保存数据卡片',
    label: '卡片名称',
    defaultValue: nextCardName(snapshot.roleName),
    kind: 'card',
  });
  if (!name) return -1;
  const index = saveCardSnapshot(snapshot, name);
  if (index >= 0) {
    setSaveStatus(`已保存 ${name}`);
    renderCardRoleFilter();
  }
  return index;
}

function setComparisonSide(index, side) {
  if (!comparisonSnapshots[index]) return;
  if (side === 'left') comparisonPair[0] = index;
  else comparisonPair[1] = index;
  comparisonPair = normalizeComparisonPair(comparisonPair);
  saveConfig();
  renderComparison();
  renderSavedCards();
}

function removeSavedCard(index) {
  const snapshot = comparisonSnapshots[index];
  if (!snapshot) return;
  const cardId = snapshot.cardId;
  comparisonSnapshots.splice(index, 1);
  teams.forEach((team) => {
    team.slots = team.slots.map((slot) => slot === cardId ? null : slot);
  });
  const shift = (value) => value === index ? 0 : value > index ? value - 1 : value;
  comparisonPair = normalizeComparisonPair(comparisonPair.map(shift));
  activeComparisonIndex = null;
  saveConfig();
  renderComparison();
  renderSavedCards();
  renderTeams();
  setSaveStatus('已删除数据卡片');
}

function deleteSavedCard(index) {
  const snapshot = comparisonSnapshots[index];
  if (!snapshot) return;
  openConfirmationDialog(`确认删除数据卡片“${snapshot.name || snapshot.roleName}”吗？`, () => removeSavedCard(index));
}

function renderCardRoleFilter() {
  const select = $('card-role-filter');
  if (!select) return;
  const previous = select.value;
  const roles = [...new Set(comparisonSnapshots.map((card) => card.roleName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  select.innerHTML = '<option value="">全部角色</option>'
    + roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join('');
  select.value = roles.includes(previous) ? previous : '';
}

function cardStatsMarkup(snapshot) {
  const stats = SECONDARY_STAT_DEFS.map((definition) => {
    const value = snapshot.stats?.[definition.key];
    if (value === null || value === undefined || Number(value) === 0) return '';
    return `<span>${definition.label} <b>${formatSecondaryValue(definition.key, value)}</b></span>`;
  }).filter(Boolean).join('');
  return `<div class="saved-card-stats"><span>生命 <b>${formatNumber(snapshot.hp)}</b></span><span>攻击 <b>${formatNumber(snapshot.attack)}</b></span>${stats}</div>`;
}

function renderSavedCards() {
  const content = $('saved-card-list');
  if (!content) return;
  renderCardRoleFilter();
  const role = $('card-role-filter')?.value || '';
  const query = ($('card-search')?.value || '').trim().toLocaleLowerCase();
  const visible = comparisonSnapshots.map((card, index) => ({ card, index })).filter(({ card }) => {
    if (role && card.roleName !== role) return false;
    if (!query) return true;
    return [card.name, card.roleName, card.martialName, card.innerName, ...(card.equipmentNames || [])]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
  });
  $('card-count').textContent = `${comparisonSnapshots.length} / ${MAX_COMPARISON_SNAPSHOTS}`;
  if (!visible.length) {
    content.innerHTML = `<div class="empty-collection"><strong>${comparisonSnapshots.length ? '没有匹配的数据卡片' : '还没有数据卡片'}</strong><span>${comparisonSnapshots.length ? '更换筛选条件试试' : '在计算器生成结果后，保存为数据卡片'}</span></div>`;
    return;
  }
  content.innerHTML = visible.map(({ card, index }) => `
    <article class="saved-data-card${activeComparisonIndex === index ? ' is-active' : ''}">
      <div class="saved-card-heading">
        <div class="saved-card-title"><strong>${escapeHtml(card.name || `${card.roleName}${comparisonCode(index)}`)}</strong><span>${escapeHtml(card.roleName)} · 等级 ${card.level}</span></div>
        <button class="icon-button card-delete-button" type="button" data-card-delete="${index}" aria-label="删除${escapeHtml(card.name || '数据卡片')}" title="删除">×</button>
      </div>
      ${cardStatsMarkup(card)}
      <div class="saved-card-loadout">${escapeHtml(snapshotDisplayText(card) || '未记录武学、内功或装备')}</div>
      <div class="saved-card-actions">
        <button class="text-button" type="button" data-card-left="${index}">设为左侧</button>
        <button class="text-button" type="button" data-card-right="${index}">设为右侧</button>
      </div>
    </article>`).join('');
  content.querySelectorAll('[data-card-delete]').forEach((button) => button.addEventListener('click', () => deleteSavedCard(Number(button.dataset.cardDelete))));
  content.querySelectorAll('[data-card-left]').forEach((button) => button.addEventListener('click', () => setComparisonSide(Number(button.dataset.cardLeft), 'left')));
  content.querySelectorAll('[data-card-right]').forEach((button) => button.addEventListener('click', () => setComparisonSide(Number(button.dataset.cardRight), 'right')));
}

function teamCardFromId(cardId) {
  return comparisonSnapshots.find((card) => card.cardId === cardId) || null;
}

function renderTeamRoleFilter() {
  const selects = [$('team-picker-role-filter')].filter(Boolean);
  const slotIndex = pendingTeamPicker?.slotIndex ?? 0;
  const roles = [...new Set(comparisonSnapshots
    .filter((card) => teamSlotRoleAllowed(card.roleName, slotIndex))
    .map((card) => card.roleName)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  selects.forEach((select) => {
    const previous = select.value;
    select.innerHTML = '<option value="">全部角色</option>'
      + roles.map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join('');
    select.value = roles.includes(previous) ? previous : '';
  });
}

function renderTeamPicker() {
  const content = $('team-picker-list');
  if (!content || !pendingTeamPicker) return;
  const team = teams.find((item) => item.id === pendingTeamPicker.teamId);
  if (!team) return;
  const currentCardId = team.slots[pendingTeamPicker.slotIndex];
  const usedCardIds = new Set(team.slots.filter(Boolean));
  usedCardIds.delete(currentCardId);
  const usedRoles = new Set(team.slots.filter(Boolean).map((cardId) => teamCardFromId(cardId)?.roleName).filter(Boolean));
  if (currentCardId) usedRoles.delete(teamCardFromId(currentCardId)?.roleName);
  const role = $('team-picker-role-filter')?.value || '';
  const query = ($('team-picker-search')?.value || '').trim().toLocaleLowerCase();
  const currentCard = teamCardFromId(currentCardId);
  const currentDetail = currentCard ? `<div class="team-picker-current">
    <div class="saved-card-heading"><div class="saved-card-title"><strong>${escapeHtml(currentCard.name)}</strong><span>${escapeHtml(currentCard.roleName)} · 等级 ${currentCard.level}</span></div><span class="manual-tag">当前位置</span></div>
    ${cardStatsMarkup(currentCard)}
    <div class="saved-card-loadout">${escapeHtml(snapshotDisplayText(currentCard) || '未记录武学、内功或装备')}</div>
  </div>` : '';
  const cards = comparisonSnapshots.filter((card) => {
    if (!teamSlotRoleAllowed(card.roleName, pendingTeamPicker.slotIndex)) return false;
    if (role && card.roleName !== role) return false;
    if (query && ![card.name, card.roleName, card.martialName, card.innerName].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)) return false;
    return true;
  });
  if (!cards.length) {
    content.innerHTML = `${currentDetail}<div class="empty-collection"><strong>没有匹配的方案</strong><span>先保存数据卡片，再加入配队</span></div>`;
    return;
  }
  content.innerHTML = currentDetail + cards.map((card) => {
    const unavailable = usedCardIds.has(card.cardId) || usedRoles.has(card.roleName);
    const reason = usedRoles.has(card.roleName) ? '该角色已在队伍中' : usedCardIds.has(card.cardId) ? '已加入此队伍' : '';
    return `<button class="team-picker-card${unavailable ? ' is-unavailable' : ''}" type="button" data-team-card="${escapeHtml(card.cardId)}" ${unavailable ? 'disabled' : ''}>
      <span><strong>${escapeHtml(card.name)}</strong><em>${escapeHtml(card.roleName)}${reason ? ` · ${reason}` : ''}</em></span>
      <b>${formatNumber(card.hp)} / ${formatNumber(card.attack)}</b>
    </button>`;
  }).join('');
  content.querySelectorAll('[data-team-card]').forEach((button) => button.addEventListener('click', () => {
    const selected = teamCardFromId(button.dataset.teamCard);
    if (!selected) return;
    if (!teamSlotRoleAllowed(selected.roleName, pendingTeamPicker.slotIndex)) return;
    team.slots[pendingTeamPicker.slotIndex] = selected.cardId;
    team.updatedAt = Date.now();
    saveConfig();
    closeTeamPicker();
    renderTeams();
  }));
}

function openTeamPicker(teamId, slotIndex) {
  pendingTeamPicker = { teamId, slotIndex };
  renderTeamRoleFilter();
  $('team-picker-role-filter').value = '';
  $('team-picker-search').value = '';
  $('team-picker-modal').hidden = false;
  renderTeamPicker();
}

function closeTeamPicker() {
  pendingTeamPicker = null;
  $('team-picker-modal').hidden = true;
}

function removeTeam(teamId) {
  const team = teams.find((item) => item.id === teamId);
  if (!team) return;
  teams = teams.filter((item) => item.id !== teamId);
  if (expandedTeamId === teamId) expandedTeamId = null;
  saveConfig();
  renderTeams();
  setSaveStatus('已删除配队');
}

function deleteTeam(teamId) {
  const team = teams.find((item) => item.id === teamId);
  if (!team) return;
  openConfirmationDialog(`确认删除配队“${team.name}”吗？`, () => removeTeam(teamId));
}

async function renameTeam(teamId) {
  const team = teams.find((item) => item.id === teamId);
  if (!team) return;
  const previousName = team.name;
  const name = await openNameDialog({ title: '修改配队名称', label: '配队名称', defaultValue: team.name, kind: 'team', confirmLabel: '修改', excludeId: team.id });
  if (!name || name === previousName) return;
  if (teams.some((item) => item !== team && item.name === name)) return;
  team.name = name;
  team.updatedAt = Date.now();
  saveConfig();
  renderTeams();
}

async function createTeam() {
  if (teams.length >= MAX_TEAMS) {
    setSaveStatus(`配队已达到 ${MAX_TEAMS} 个上限`);
    return -1;
  }
  const name = await openNameDialog({ title: '新建配队', label: '配队名称', defaultValue: defaultTeamName(), kind: 'team' });
  if (!name) return;
  teams.push({ id: localId('team'), name, slots: Array(MAX_TEAM_SLOTS).fill(null), createdAt: Date.now(), updatedAt: Date.now() });
  saveConfig();
  renderTeams();
  setSaveStatus(`已创建 ${name}`);
}

function teamCardDetailMarkup(team) {
  const rows = team.slots.map((cardId, slotIndex) => {
    const card = teamCardFromId(cardId);
    if (!card) return '';
    return `
      <article class="team-detail-row">
        <span class="team-detail-position">${String(slotIndex + 1).padStart(2, '0')}</span>
        <div class="team-detail-body">
          <div class="team-detail-heading">
            <strong>${escapeHtml(card.name)}</strong>
            <span>${escapeHtml(card.roleName)} · 等级 ${card.level}</span>
          </div>
          ${cardStatsMarkup(card)}
          <div class="team-detail-loadout">${escapeHtml(snapshotDisplayText(card) || '未记录武学、内功或装备')}</div>
        </div>
      </article>`;
  }).filter(Boolean).join('');
  return rows
    ? `<div class="team-detail-list">${rows}</div>`
    : '<div class="team-detail-empty">暂无方案</div>';
}

function openTeamDetail(teamId) {
  const team = teams.find((item) => item.id === teamId);
  if (!team) return;
  $('team-detail-modal-title').textContent = `${team.name} · 配队详情`;
  $('team-detail-content').innerHTML = teamCardDetailMarkup(team);
  $('team-detail-modal').hidden = false;
}

function closeTeamDetail() {
  $('team-detail-modal').hidden = true;
}

function renderTeams() {
  const content = $('team-list');
  if (!content) return;
  const query = ($('team-search')?.value || '').trim().toLocaleLowerCase();
  const visible = teams.filter((team) => !query || team.name.toLocaleLowerCase().includes(query));
  $('team-count').textContent = `${teams.length} / ${MAX_TEAMS} 个配队`;
  const createButton = $('create-team-button');
  if (createButton) {
    const atLimit = teams.length >= MAX_TEAMS;
    createButton.disabled = atLimit;
    createButton.title = atLimit ? `配队已达到 ${MAX_TEAMS} 个上限` : '新建配队';
  }
  if (!visible.length) {
    content.innerHTML = `<div class="empty-collection"><strong>${teams.length ? '没有匹配的配队' : '配队还是空的'}</strong><span>${teams.length ? '更换搜索内容试试' : '点击右上角“新建配队”，再用加号填入数据卡片'}</span></div>`;
    return;
  }
  content.innerHTML = visible.map((team) => {
    const expanded = expandedTeamId === team.id;
    const detailId = `team-detail-${team.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    return `
    <article class="team-card${expanded ? ' is-expanded' : ''}">
      <div class="team-card-heading">
        <button class="team-card-toggle" type="button" data-team-toggle="${escapeHtml(team.id)}" aria-expanded="${expanded}" aria-controls="${escapeHtml(detailId)}">
          <span class="team-card-toggle-copy"><strong>${escapeHtml(team.name)}</strong><span>${team.slots.filter(Boolean).length} / ${MAX_TEAM_SLOTS} 个位置</span></span>
          <span class="team-card-toggle-action">${expanded ? '收起' : '展开'}</span>
        </button>
        <div class="team-card-actions"><button class="text-button" type="button" data-team-detail="${escapeHtml(team.id)}">详情</button><button class="text-button" type="button" data-team-rename="${escapeHtml(team.id)}">改名</button><button class="icon-button card-delete-button" type="button" data-team-delete="${escapeHtml(team.id)}" aria-label="删除配队" title="删除">×</button></div>
      </div>
      <div class="team-card-detail" id="${escapeHtml(detailId)}"${expanded ? '' : ' hidden'}>
        <div class="team-slots">${team.slots.map((cardId, slotIndex) => {
        const card = teamCardFromId(cardId);
        return card
          ? `<button class="team-slot is-filled" type="button" data-team-add="${escapeHtml(team.id)}" data-team-slot="${slotIndex}"><small>${String(slotIndex + 1).padStart(2, '0')}</small><strong>${escapeHtml(card.roleName)}</strong><span>${escapeHtml(card.name)}</span><b>${formatNumber(card.hp)} · ${formatNumber(card.attack)}</b></button>`
          : `<button class="team-slot is-empty" type="button" data-team-add="${escapeHtml(team.id)}" data-team-slot="${slotIndex}"><small>${String(slotIndex + 1).padStart(2, '0')}</small><strong>＋</strong><span>添加方案</span></button>`;
        }).join('')}</div>
      </div>
    </article>`;
  }).join('');
  content.querySelectorAll('[data-team-toggle]').forEach((button) => button.addEventListener('click', () => {
    const teamId = button.dataset.teamToggle;
    expandedTeamId = expandedTeamId === teamId ? null : teamId;
    renderTeams();
  }));
  content.querySelectorAll('[data-team-detail]').forEach((button) => button.addEventListener('click', () => openTeamDetail(button.dataset.teamDetail)));
  content.querySelectorAll('[data-team-add]').forEach((button) => button.addEventListener('click', () => openTeamPicker(button.dataset.teamAdd, Number(button.dataset.teamSlot))));
  content.querySelectorAll('[data-team-delete]').forEach((button) => button.addEventListener('click', () => deleteTeam(button.dataset.teamDelete)));
  content.querySelectorAll('[data-team-rename]').forEach((button) => button.addEventListener('click', () => renameTeam(button.dataset.teamRename)));
}

const ENCYCLOPEDIA_EQUIPMENT_SLOT_LABELS = {
  'weapon-staff': '棍武器',
  'weapon-blade': '刀武器',
  'weapon-fist': '拳武器',
  'weapon-sword': '剑武器',
  armor: '衣甲',
  ring: '戒指',
  wrist: '护腕',
};
const ENCYCLOPEDIA_WEAPON_SLOTS = {
  1: 'weapon-fist',
  2: 'weapon-sword',
  3: 'weapon-blade',
  4: 'weapon-staff',
};
const ENCYCLOPEDIA_DUNGEONS = [
  { id: 'huxiaolin', name: '虎啸林', aliases: ['虎啸林'] },
  { id: 'xuanwudao', name: '玄武岛', aliases: ['玄武岛'] },
  { id: 'qiulonggu', name: '囚龙谷', aliases: ['囚龙谷外围', '囚龙谷内围', '囚龙谷'] },
  { id: 'wujian', name: '无间地狱', aliases: ['无间地狱二层', '无间地狱'] },
  { id: 'minglidigong', name: '冥离地宫', aliases: ['冥离地宫'] },
  { id: 'fengmingshan', name: '凤鸣山', aliases: ['凤鸣山'] },
  { id: 'wulongta', name: '五龙塔', aliases: ['五龙塔'] },
  { id: 'baxiantu', name: '八阵图', aliases: ['八阵图'] },
  { id: 'shaolancangjingge', name: '少林藏经阁', aliases: ['少林寺藏经阁', '少林藏经阁'] },
];
function encyclopediaText(...values) {
  return values.flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
}
function innerEncyclopediaEffect(item) {
  const stats = innerStatsSummary({
    hp: Number(item?.hp_percent) || 0,
    attack: Number(item?.attack_percent) || 0,
    secondary: secondaryStatsFromRecord(item),
  });
  return [
    stats !== '无属性' ? stats : '',
    item?.ren_du ? `大任督：${item.ren_du}` : '',
    item?.special || '',
    item?.conditional_mitigation_percent
      ? `${item.conditional_mitigation_condition || '满足条件时'}增加${formatPercent(item.conditional_mitigation_percent)}免伤`
      : '',
  ].filter(Boolean).join('；') || '特殊效果待补';
}
function innerEncyclopediaMeta(item) {
  const format = (value) => formatPercent(Number(value) || 0);
  return encyclopediaText(
    String(item?.rank || '').trim().replace('？', '?').toUpperCase(),
    `免伤 ${format(item?.mitigation_percent)}`,
    `血量 ${format(item?.hp_percent)}`,
    `攻击 ${format(item?.attack_percent)}`,
  );
}
function martialRuleSummary(item) {
  const rule = martialRule(item);
  const parts = [];
  const maxPercent = Number(rule.max_percent ?? rule.maxPercent);
  if (rule.technique && Number.isFinite(maxPercent) && maxPercent > 0) {
    parts.push(`${rule.technique}满级 +${formatPercent(maxPercent)}武学威力`);
  }
  rule.damageEffects.forEach((effect) => {
    const source = ({
      base_attack: '人物基础攻击',
      weapon_attack: '武器白值攻击',
      final_attack: '最终攻击',
      max_hp: '最终生命',
    })[effect.source] || effect.source;
    const chance = effect.chance_percent ?? effect.chancePercent;
    const period = effect.period_rounds ?? effect.periodRounds;
    parts.push(`${period > 0 ? `每${period}回合` : ''}${chance < 100 ? `${formatPercent(chance)}概率` : ''}附加${formatPercent(effect.percent)}${source}伤害`);
  });
  return parts.join('；');
}
function encyclopediaDungeonGroups() {
  const groups = ENCYCLOPEDIA_DUNGEONS.map((dungeon) => ({
    ...dungeon,
    bosses: [],
    bossMap: new Map(),
  }));
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const seen = new Set();
  const addDrop = (group, bossName, drop) => {
    if (!group) return;
    const normalizedBoss = String(bossName || '副本掉落').trim() || '副本掉落';
    const seenKey = [
      group.id,
      normalizedBoss,
      drop.name,
      drop.typeLabel,
      drop.meta,
      drop.source,
      drop.detail,
    ].map((value) => String(value || '').trim()).join('|');
    if (seen.has(seenKey)) return;
    seen.add(seenKey);
    if (!group.bossMap.has(normalizedBoss)) {
      const boss = { name: normalizedBoss, drops: [] };
      group.bossMap.set(normalizedBoss, boss);
      group.bosses.push(boss);
    }
    group.bossMap.get(normalizedBoss).drops.push(drop);
  };
  (state.whiteRabbit?.dungeon_drops || []).forEach((record, index) => {
    const dungeon = ENCYCLOPEDIA_DUNGEONS.find((candidate) => (
      candidate.aliases.some((alias) => String(record.dungeon || '').includes(alias))
    ));
    if (!dungeon || !record.name) return;
    addDrop(groupMap.get(dungeon.id), record.boss || '副本掉落', {
      id: record.id || `explicit-dungeon-drop-${index}`,
      name: record.name,
      typeLabel: record.type || '掉落',
      meta: record.drop || '',
      summary: record.drop || '',
      detail: record.note || '',
      source: record.drop || '攻略记录',
    });
  });
  return groups.map(({ bossMap, aliases, ...group }) => group);
}
function encyclopediaRecords(type) {
  const white = state.whiteRabbit || {};
  if (type === 'dungeon_drops') {
    return encyclopediaDungeonGroups().flatMap((group) => group.bosses.flatMap((boss) => (
      boss.drops.map((drop) => ({
        ...drop,
        dungeonId: group.id,
        dungeonName: group.name,
        bossName: boss.name,
        meta: encyclopediaText(drop.typeLabel, drop.meta),
        access: drop.source,
      }))
    )));
  }
  if (type === 'characters') {
    return (white.characters || []).map((item, index) => ({
      id: item.id || `character-${index}`,
      name: item.name,
      style: item.style || '',
      hpFactor: Number(item.hp_factor) || 0,
      powerFactor: Number(item.power_factor) || 0,
      totalGrowth: (Number(item.hp_factor) || 0) + (Number(item.power_factor) || 0),
      meta: encyclopediaText(item.style || '职业待补', `生命系数 ${item.hp_factor}`, `攻击系数 ${item.power_factor}`),
      summaryLabel: '特性',
      summary: item.talent || '特性待补',
      access: item.access || '获取方式待补',
      detail: '',
    }));
  }
  if (type === 'techniques') {
    return techniqueOptionEntries().map((item) => ({
      id: `technique-${item.id}`,
      name: techniqueDisplayName(item),
      meta: encyclopediaText(item.group === 'wolong' ? '' : item.parentName && item.parentName !== item.name ? item.parentName : '', item.scope || '通用', item.max_level ? `上限 ${item.max_level} 级` : ''),
      summaryLabel: '技艺效果',
      summary: item.effect || '效果待补',
      access: item.access || '获取方式待补',
      detail: item.group === 'wolong' ? '' : item.upgrade && `升级：${item.upgrade}`,
      sourceText: encyclopediaText(item.access, item.upgrade),
      encyclopediaCategory: item.encyclopedia_category || '',
    }));
  }
  if (type === 'inner_skills') {
    return (white.inner_skills || []).filter((item) => String(item.rank || '').trim()).map((item, index) => ({
      id: item.id || `inner-${index}`,
      name: item.name,
      rank: String(item.rank || '').trim().replace('？', '?').toUpperCase(),
      hpPercent: Number(item.hp_percent) || 0,
      attackPercent: Number(item.attack_percent) || 0,
      mitigationPercent: Number(item.mitigation_percent) || 0,
      meta: innerEncyclopediaMeta(item),
      summaryLabel: '内功效果',
      summary: innerEncyclopediaEffect(item),
      access: item.access || '获取方式待补',
      detail: item.designer ? `设计：${item.designer}` : '',
      sourceText: item.access || '',
    }));
  }
  if (type === 'martial_arts') {
    return (white.martial_arts || []).filter((item) => String(item.rank || '').trim()).map((item, index) => ({
      id: item.id || `martial-${index}`,
      name: item.name,
      style: item.style || '',
      rank: displayMartialRank(item.rank),
      power: Number(item.power) || 0,
      speed: Number(item.speed) || 0,
      critPercent: Number(item.crit_percent) || 0,
      meta: encyclopediaText(item.style || '流派待补', displayMartialRank(item.rank), `威力 ${Number(item.power) || 0}`, `速度 ${Number(item.speed) || 0}`, martialRange(item)),
      summaryLabel: '武学效果',
      summary: encyclopediaText(item.double_break, item.crit_percent != null && `暴击 ${formatPercent(item.crit_percent)}`, martialCritDamageLabel(item.crit_damage), item.buff, item.special, martialRuleSummary(item)) || '武学效果待补',
      access: item.access || '获取方式待补',
      detail: '',
      rank: displayMartialRank(item.rank),
      power: Number(item.power) || 0,
      speed: Number(item.speed) || 0,
      range: martialRange(item),
      doubleBreak: item.double_break || '',
      critPercent: item.crit_percent,
      critDamage: item.crit_damage,
      buff: item.buff || '',
      special: item.special || '',
      ruleSummary: martialRuleSummary(item),
      sourceText: item.access || '',
    }));
  }
  if (type === 'equipment') {
    const whiteRecords = (white.equipment || []).map((item, index) => {
      const equipmentSlot = equipmentCategory(item);
      const forgeSummary = isWeapon(item) && Array.isArray(item.forge_options) && item.forge_options.length
        ? `可锻造：${item.forge_options.join('；')}`
        : '';
      return {
        id: item.id || `equipment-${index}`,
        name: item.name || item.nick,
        equipmentSlot,
        meta: encyclopediaText(ENCYCLOPEDIA_EQUIPMENT_SLOT_LABELS[equipmentSlot] || '装备部位待补', item.rank, equipmentSummary(item), item.scope || '佩戴者'),
        summaryLabel: '装备效果',
        summary: encyclopediaText(item.special, forgeSummary) || '特殊效果待补',
        access: isWeapon(item) ? '' : (item.access || '获取方式待补'),
        detail: encyclopediaText(
          item.unique && '唯一装备',
          Array.isArray(item.aliases) && item.aliases.length && `别名：${item.aliases.join('、')}`,
          item.designer && `设计：${item.designer}`,
        ),
        sourceText: isWeapon(item) ? '' : (item.access || ''),
      };
    });
    return whiteRecords;
  }
  return [];
}

function encyclopediaFavoriteEntries() {
  const recordsByType = new Map();
  return [...encyclopediaFavorites].map((value) => {
    const key = String(value);
    const separator = key.indexOf(':');
    const type = separator > 0 ? key.slice(0, separator) : 'characters';
    const id = separator > 0 ? key.slice(separator + 1) : key;
    if (!recordsByType.has(type)) {
      recordsByType.set(type, new Map(encyclopediaRecords(type).map((item) => [String(item.id), item])));
    }
    const record = recordsByType.get(type).get(id);
    return record ? { key, type, id, record } : null;
  }).filter(Boolean);
}

window.jianghuEncyclopedia = {
  getFavoriteEntries: () => encyclopediaFavoriteEntries(),
  toggleFavorite: (id) => toggleEncyclopediaFavorite(String(id || '')),
  focusRecord(type, id) {
    const normalizedType = String(type || '');
    const normalizedId = String(id || '');
    const selector = $('encyclopedia-type');
    if (selector && selector.value !== normalizedType) selector.value = normalizedType;
    const search = $('encyclopedia-search');
    if (search) search.value = '';
    ['encyclopedia-martial-filter', 'encyclopedia-martial-rank-filter', 'encyclopedia-inner-rank-filter', 'encyclopedia-equipment-filter']
      .forEach((id) => { const field = $(id); if (field) field.value = ''; });
    characterStyleFilter = '';
    renderEncyclopedia();
    const record = encyclopediaRecords(normalizedType).find((item) => String(item.id) === normalizedId);
    if (!record) return;
    if (normalizedType === 'martial_arts') {
      openMartialDetail(record);
      $('encyclopedia-detail-view')?.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
    const target = [...document.querySelectorAll('[data-encyclopedia-record-id]')]
      .find((element) => element.dataset.encyclopediaRecordId === normalizedId);
    if (!target) return;
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.classList.add('is-target');
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
  },
};

function characterStyleOptions() {
  return ['', '刀法', '剑法', '棍法', '拳法'];
}

function renderCharacterControls() {
  const filterBar = $('character-filter-bar');
  const sortBar = $('character-sort-bar');
  if (!filterBar || !sortBar) return;
  filterBar.innerHTML = characterStyleOptions().map((style) => `
    <button type="button" class="character-filter-button${characterStyleFilter === style ? ' is-active' : ''}" data-character-style="${escapeHtml(style)}">${escapeHtml(style || '全部')}</button>
  `).join('');
  sortBar.querySelectorAll('[data-character-sort]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.characterSort === characterSort);
  });
  updateEncyclopediaSortButtons('character-sort-bar', 'characterSort', characterSort, characterSortDirection, {
    total: '综合成长',
    hp: '生命成长',
    power: '攻击成长',
  });
}

function encyclopediaFavoriteId(type, record) {
  return `${type}:${record.id}`;
}

function isEncyclopediaFavorite(type, record) {
  const id = encyclopediaFavoriteId(type, record);
  return encyclopediaFavorites.has(id) || (type === 'characters' && encyclopediaFavorites.has(String(record.id)));
}

function sortCharacterRecords(records) {
  const valueFor = (record) => {
    if (characterSort === 'hp') return record.hpFactor;
    if (characterSort === 'power') return record.powerFactor;
    return record.totalGrowth;
  };
  return records.slice().sort((left, right) => (
    (valueFor(right) - valueFor(left)) * (characterSortDirection === 'desc' ? 1 : -1)
    || right.totalGrowth - left.totalGrowth
    || left.name.localeCompare(right.name, 'zh-CN')
  ));
}

function sortEncyclopediaRecords(records, type) {
  const sortKey = type === 'martial_arts' ? martialSort : innerSort;
  const valueFor = (record) => {
    if (type === 'martial_arts') {
      if (sortKey === 'speed') return record.speed;
      if (sortKey === 'crit') return record.critPercent;
      return record.power;
    }
    if (sortKey === 'hp') return record.hpPercent;
    if (sortKey === 'attack') return record.attackPercent;
    return record.mitigationPercent;
  };
  return records.slice().sort((left, right) => (
    (valueFor(right) - valueFor(left)) * ((type === 'martial_arts' ? martialSortDirection : innerSortDirection) === 'desc' ? 1 : -1)
    || left.name.localeCompare(right.name, 'zh-CN')
  ));
}

function updateEncyclopediaSortButtons(id, dataKey, activeKey, direction, labels) {
  const bar = $(id);
  if (!bar) return;
  bar.querySelectorAll(`[data-${dataKey}]`).forEach((button) => {
    const key = button.dataset[dataKey];
    button.classList.toggle('is-active', key === activeKey);
    button.textContent = `${labels[key]}${key === activeKey ? (direction === 'desc' ? '降序' : '升序') : ''}`;
  });
}

function renderCharacterCard(record) {
  const favoriteId = encyclopediaFavoriteId('characters', record);
  const isFavorite = isEncyclopediaFavorite('characters', record);
  return `
    <details class="encyclopedia-character-card" data-encyclopedia-record-id="${escapeHtml(record.id)}">
      <summary class="character-card-summary">
        <div class="character-card-title">
          <h3>${escapeHtml(record.name || '未命名')}</h3>
        </div>
        <span class="character-card-meta">${escapeHtml(record.meta || '数据待补')}</span>
      </summary>
      <div class="character-card-detail">
        <div class="character-detail-heading">
          <div class="character-detail-style">
            <span>流派</span>
            <strong>${escapeHtml(record.style || '职业待补')}</strong>
          </div>
          <button type="button" class="character-favorite-button${isFavorite ? ' is-favorite' : ''}" data-encyclopedia-favorite="${escapeHtml(favoriteId)}" aria-label="${isFavorite ? '取消收藏' : '收藏'}${escapeHtml(record.name || '角色')}" aria-pressed="${isFavorite ? 'true' : 'false'}">
            <span aria-hidden="true">${isFavorite ? '♥' : '♡'}</span>
          </button>
        </div>
        <div class="character-growth-grid" aria-label="${escapeHtml(record.name || '角色')}成长属性">
          <div><span>生命成长</span><strong>${record.hpFactor.toFixed(2)}</strong></div>
          <div><span>攻击成长</span><strong>${record.powerFactor.toFixed(2)}</strong></div>
          <div class="is-total"><span>综合成长</span><strong>${record.totalGrowth.toFixed(2)}</strong></div>
        </div>
        <div class="character-talent">
          <strong>天赋：</strong>
          <p>${escapeHtml(record.summary || '特性待补')}</p>
        </div>
        <div class="character-access">
          <span>获取：</span>
          <p>${escapeHtml(record.access || '获取方式待补')}</p>
        </div>
      </div>
    </details>
  `;
}

function martialIsLimitedCopy(access) {
  const text = String(access || '').normalize('NFKC').replace(/\s/g, '');
  return /(?:^|[^不限])限(?:1(?!\d)|一(?![二三四五六七八九十百千万]))/.test(text);
}

function encyclopediaCardBadge(type, record) {
  if (type === 'martial_arts') return record.style || '武学';
  if (type === 'inner_skills') return '';
  if (type === 'techniques') return '';
  if (type === 'equipment') return ENCYCLOPEDIA_EQUIPMENT_SLOT_LABELS[record.equipmentSlot] || '装备';
  return '';
}

function encyclopediaCardMeta(type, record) {
  const parts = String(record.meta || '').split(' · ').filter(Boolean);
  if (type === 'martial_arts' || type === 'equipment') return parts.slice(1).join(' · ');
  return parts.join(' · ');
}

function renderEncyclopediaCard(type, record) {
  const badge = encyclopediaCardBadge(type, record);
  const meta = encyclopediaCardMeta(type, record);
  const favoriteId = encyclopediaFavoriteId(type, record);
  const isFavorite = isEncyclopediaFavorite(type, record);
  if (type === 'martial_arts') {
    return `
      <article class="encyclopedia-card encyclopedia-martial-card" data-encyclopedia-record-id="${escapeHtml(record.id)}">
        <div class="encyclopedia-card-summary">
          <span class="encyclopedia-card-heading">
            <span class="encyclopedia-card-title-line">
              <span class="encyclopedia-card-badge">${escapeHtml(badge || '武学')}</span>
              ${martialIsLimitedCopy(record.access) ? '<span class="encyclopedia-card-badge">孤本</span>' : ''}
              <strong>${escapeHtml(record.name || '未命名')}</strong>
            </span>
            ${meta ? `<span class="encyclopedia-card-meta">${escapeHtml(meta)}</span>` : ''}
          </span>
          <span class="encyclopedia-card-action">
            <button type="button" class="encyclopedia-favorite-button${isFavorite ? ' is-favorite' : ''}" data-encyclopedia-favorite="${escapeHtml(favoriteId)}" aria-label="${isFavorite ? '取消收藏' : '收藏'}${escapeHtml(record.name || '武学')}" aria-pressed="${isFavorite ? 'true' : 'false'}"><span aria-hidden="true">${isFavorite ? '♥' : '♡'}</span></button>
            <button type="button" class="encyclopedia-card-detail-button" data-martial-detail="${escapeHtml(record.id)}">详情 <b aria-hidden="true">›</b></button>
          </span>
        </div>
      </article>
    `;
  }
  return `
    <details class="encyclopedia-card" data-encyclopedia-record-id="${escapeHtml(record.id)}">
      <summary class="encyclopedia-card-summary">
        <span class="encyclopedia-card-heading">
          <span class="encyclopedia-card-title-line">
            ${badge ? `<span class="encyclopedia-card-badge">${escapeHtml(badge)}</span>` : ''}
            <strong>${escapeHtml(record.name || '未命名')}</strong>
          </span>
          ${meta ? `<span class="encyclopedia-card-meta">${escapeHtml(meta)}</span>` : ''}
        </span>
        <span class="encyclopedia-card-action">
          <button type="button" class="encyclopedia-favorite-button${isFavorite ? ' is-favorite' : ''}" data-encyclopedia-favorite="${escapeHtml(favoriteId)}" aria-label="${isFavorite ? '取消收藏' : '收藏'}${escapeHtml(record.name || '条目')}" aria-pressed="${isFavorite ? 'true' : 'false'}"><span aria-hidden="true">${isFavorite ? '♥' : '♡'}</span></button>
          <span class="encyclopedia-card-action-label">详情</span><b aria-hidden="true">›</b>
        </span>
      </summary>
      <div class="encyclopedia-card-detail${record.summary ? '' : ' is-detail-only'}">
        ${record.summary ? `<p><strong class="encyclopedia-detail-label">${escapeHtml(record.summaryLabel || '说明')}</strong>${escapeHtml(record.summary)}</p>` : ''}
        ${record.access ? `<p class="encyclopedia-card-access"><strong class="encyclopedia-detail-label">获取</strong>${escapeHtml(record.access)}</p>` : ''}
        ${record.detail ? `<p class="encyclopedia-card-note"><strong class="encyclopedia-detail-label">备注</strong>${escapeHtml(record.detail)}</p>` : ''}
      </div>
    </details>
  `;
}

function martialDetailValue(value, fallback = '待补') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function renderMartialDetail(record) {
  const favoriteId = encyclopediaFavoriteId('martial_arts', record);
  const isFavorite = isEncyclopediaFavorite('martial_arts', record);
  const effects = [
    ['破防属性', martialDetailValue(record.doubleBreak)],
    ['暴击率', record.critPercent != null ? formatPercent(record.critPercent) : '待补'],
    ['暴击倍率', martialDetailValue(record.critDamage)],
  ];
  const stateEffectPattern = /流血|中毒|眩晕|降低|减少|封穴|麻痹|沉默|虚弱|灼烧|减速|禁疗|无法行动|不能行动|禁止出手/;
  const buffText = [record.buff, record.special].filter((value) => value && value !== '/');
  const stateEffects = buffText.filter((value) => stateEffectPattern.test(value));
  const specialEffects = [
    ...buffText.filter((value) => !stateEffectPattern.test(value)),
    record.ruleSummary,
  ].filter((value) => value && value !== '/');
  const sections = [
    ['特殊效果', specialEffects.join('；')],
    ['状态效果（BUFF）', stateEffects.join('；')],
  ].filter(([, value]) => value);
  return `
    <div class="encyclopedia-detail-topbar">
      <button type="button" class="encyclopedia-detail-back" data-encyclopedia-detail-back><span aria-hidden="true">‹</span> 返回</button>
      <strong>武学资料</strong>
      <button type="button" class="encyclopedia-detail-favorite${isFavorite ? ' is-favorite' : ''}" data-encyclopedia-favorite="${escapeHtml(favoriteId)}" aria-label="${isFavorite ? '取消收藏' : '收藏'}${escapeHtml(record.name || '武学')}" aria-pressed="${isFavorite ? 'true' : 'false'}"><span aria-hidden="true">${isFavorite ? '♥' : '♡'}</span></button>
    </div>
    <section class="encyclopedia-detail-hero">
      <div class="encyclopedia-detail-title">
        <h2>${escapeHtml(record.name || '未命名')}</h2>
        <div class="encyclopedia-detail-tags">
          <span>${escapeHtml(record.style || '流派待补')}</span>
          <span>${escapeHtml(record.rank || '品阶待补')}</span>
        </div>
      </div>
      <div class="encyclopedia-detail-access">
        <strong>【获取途径】</strong>
        <p>${escapeHtml(record.access || '获取方式待补')}</p>
      </div>
    </section>
    <section class="encyclopedia-detail-section">
      <h3><span aria-hidden="true">⚔</span> 武学基础数值</h3>
      <div class="encyclopedia-stat-grid">
        <div><span>威力</span><strong class="is-accent">${martialDetailValue(record.power)}</strong></div>
        <div><span>速度</span><strong>${martialDetailValue(record.speed)}</strong></div>
        <div><span>范围</span><strong>${escapeHtml(martialDetailValue(record.range))}</strong></div>
        ${effects.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}
      </div>
    </section>
    ${sections.map(([title, value]) => `
      <section class="encyclopedia-detail-section">
        <h3><span aria-hidden="true">${title === '获取途径' ? '⌖' : title === '规则说明' ? '◇' : '✦'}</span> ${escapeHtml(title)}</h3>
        <div class="encyclopedia-detail-copy">${escapeHtml(value)}</div>
      </section>
    `).join('')}
  `;
}

function openMartialDetail(record) {
  const detail = $('encyclopedia-detail-view');
  const heading = document.querySelector('#encyclopedia-view > .collection-heading');
  const toolbar = $('encyclopedia-toolbar');
  const list = $('encyclopedia-list');
  const characterFilterBar = $('character-filter-bar');
  const characterSortBar = $('character-sort-bar');
  const martialSortBar = $('martial-sort-bar');
  const innerSortBar = $('inner-sort-bar');
  if (!detail || !record) return;
  detail.innerHTML = renderMartialDetail(record);
  detail.hidden = false;
  if (heading) heading.hidden = true;
  if (toolbar) toolbar.hidden = true;
  if (list) list.hidden = true;
  if (characterFilterBar) characterFilterBar.hidden = true;
  if (characterSortBar) characterSortBar.hidden = true;
  if (martialSortBar) martialSortBar.hidden = true;
  if (innerSortBar) innerSortBar.hidden = true;
}

function closeEncyclopediaDetail() {
  const detail = $('encyclopedia-detail-view');
  const heading = document.querySelector('#encyclopedia-view > .collection-heading');
  const toolbar = $('encyclopedia-toolbar');
  const list = $('encyclopedia-list');
  if (detail) detail.hidden = true;
  if (heading) heading.hidden = false;
  if (toolbar) toolbar.hidden = false;
  if (list) list.hidden = false;
  renderEncyclopedia();
}

function renderEncyclopedia() {
  const content = $('encyclopedia-list');
  if (!content) return;
  const detail = $('encyclopedia-detail-view');
  const heading = document.querySelector('#encyclopedia-view > .collection-heading');
  const toolbarShell = $('encyclopedia-toolbar');
  if (detail) detail.hidden = true;
  if (heading) heading.hidden = false;
  if (toolbarShell) toolbarShell.hidden = false;
  content.hidden = false;
  const type = $('encyclopedia-type')?.value || 'characters';
  const query = ($('encyclopedia-search')?.value || '').trim().toLocaleLowerCase();
  const toolbar = $('encyclopedia-toolbar');
  const martialFilterField = $('encyclopedia-martial-filter-field');
  const martialRankFilterField = $('encyclopedia-martial-rank-filter-field');
  const innerRankFilterField = $('encyclopedia-inner-rank-filter-field');
  const equipmentFilterField = $('encyclopedia-equipment-filter-field');
  const characterFilterBar = $('character-filter-bar');
  const characterSortBar = $('character-sort-bar');
  const martialSortBar = $('martial-sort-bar');
  const innerSortBar = $('inner-sort-bar');
  const encyclopediaTitle = $('encyclopedia-title');
  const martialFilter = $('encyclopedia-martial-filter')?.value || '';
  const martialRankFilter = $('encyclopedia-martial-rank-filter')?.value || '';
  const innerRankFilter = $('encyclopedia-inner-rank-filter')?.value || '';
  const equipmentFilter = $('encyclopedia-equipment-filter')?.value || '';
  const dungeonGroups = type === 'dungeon_drops' ? encyclopediaDungeonGroups() : [];
  const hasSecondaryFilter = type === 'martial_arts' || type === 'equipment';
  const hasRankFilter = type === 'martial_arts' || type === 'inner_skills';
  toolbar?.classList.toggle('has-secondary-filter', hasSecondaryFilter);
  toolbar?.classList.toggle('has-rank-filter', hasRankFilter);
  toolbar?.classList.toggle('is-character-mode', type === 'characters');
  if (martialFilterField) martialFilterField.hidden = type !== 'martial_arts';
  if (martialRankFilterField) martialRankFilterField.hidden = type !== 'martial_arts';
  if (innerRankFilterField) innerRankFilterField.hidden = type !== 'inner_skills';
  if (equipmentFilterField) equipmentFilterField.hidden = type !== 'equipment';
  if (characterFilterBar) characterFilterBar.hidden = type !== 'characters';
  if (characterSortBar) characterSortBar.hidden = type !== 'characters';
  if (martialSortBar) martialSortBar.hidden = type !== 'martial_arts';
  if (innerSortBar) innerSortBar.hidden = type !== 'inner_skills';
  updateEncyclopediaSortButtons('martial-sort-bar', 'martialSort', martialSort, martialSortDirection, {
    power: '威力',
    speed: '速度',
    crit: '暴击率',
  });
  updateEncyclopediaSortButtons('inner-sort-bar', 'innerSort', innerSort, innerSortDirection, {
    mitigation: '免伤',
    hp: '血量加成',
    attack: '攻击加成',
  });
  if (encyclopediaTitle) encyclopediaTitle.textContent = type === 'characters' ? '伙伴角色图鉴' : '图鉴';
  if (type === 'characters') renderCharacterControls();
  const records = encyclopediaRecords(type);
  const filteredRecords = records.filter((record) => {
    if (type === 'characters' && characterStyleFilter && record.style !== characterStyleFilter) return false;
    if (type === 'martial_arts' && martialFilter && !String(record.style || '').includes(martialFilter)) return false;
    if (type === 'martial_arts' && martialRankFilter && record.rank !== martialRankFilter) return false;
    if (type === 'inner_skills' && innerRankFilter && record.rank !== innerRankFilter) return false;
    if (type === 'equipment' && equipmentFilter && record.equipmentSlot !== equipmentFilter) return false;
    return true;
  });
  let visible = filteredRecords.filter((record) => !query
    || [record.dungeonName, record.bossName, record.name, record.meta, record.summary, record.detail, record.access, record.style].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  if (type === 'characters') visible = sortCharacterRecords(visible);
  if (type === 'martial_arts' || type === 'inner_skills') visible = sortEncyclopediaRecords(visible, type);
  $('encyclopedia-count').textContent = type === 'dungeon_drops'
    ? `${visible.length} / ${filteredRecords.length} 个掉落`
    : `${visible.length} / ${filteredRecords.length} 条`;
  if (!visible.length) {
    content.innerHTML = `<div class="empty-collection"><strong>没有匹配的图鉴条目</strong><span>更换分类或搜索内容试试</span></div>`;
    return;
  }
  if (type === 'dungeon_drops') {
    const visibleKeys = new Set(visible.map((record) => String(record.id)));
    const visibleGroups = dungeonGroups.map((group) => ({
      ...group,
      bosses: group.bosses.map((boss) => ({
        ...boss,
        drops: boss.drops.filter((drop) => visibleKeys.has(String(drop.id))),
      })).filter((boss) => boss.drops.length),
    })).filter((group) => group.bosses.length);
    content.innerHTML = visibleGroups.map((group) => `
      <details class="dungeon-drop-section">
        <summary class="dungeon-drop-heading"><span><span class="dungeon-drop-kicker">副本掉落</span><strong>${escapeHtml(group.name)}</strong></span><span>${group.bosses.length} 个 Boss · ${group.bosses.reduce((sum, boss) => sum + boss.drops.length, 0)} 项掉落</span></summary>
        <div class="dungeon-boss-list">
          ${group.bosses.map((boss) => `
            <section class="dungeon-boss-group">
              <div class="dungeon-boss-heading"><strong>${escapeHtml(boss.name)}</strong><span>${boss.drops.length} 项掉落</span></div>
              <div class="dungeon-drop-items">
                ${boss.drops.map((drop) => `<div class="dungeon-drop-item"><div><strong>${escapeHtml(drop.name)}</strong><span>${escapeHtml(encyclopediaText(drop.typeLabel, drop.meta) || '类型待补')}</span></div><p>${escapeHtml(drop.source || '掉落说明待补')}</p>${drop.detail ? `<small>${escapeHtml(drop.detail)}</small>` : ''}</div>`).join('')}
              </div>
            </section>`).join('')}
        </div>
      </details>`).join('');
    return;
  }
  if (type === 'characters') {
    content.innerHTML = visible.map(renderCharacterCard).join('');
    return;
  }
  content.innerHTML = visible.map((record) => renderEncyclopediaCard(type, record)).join('');
}

function switchView(view, { persist = true } = {}) {
  activeView = ['calculator', 'teams', 'cards', 'encyclopedia'].includes(view) ? view : 'calculator';
  ['calculator', 'teams', 'cards', 'encyclopedia'].forEach((name) => {
    const element = $(`${name}-view`);
    if (element) element.hidden = name !== activeView;
    const button = document.querySelector(`[data-view="${name}"]`);
    button?.classList.toggle('is-active', name === activeView);
  });
  if (activeView === 'teams') renderTeams();
  if (activeView === 'cards') renderSavedCards();
  if (activeView === 'encyclopedia') renderEncyclopedia();
  if (persist) saveConfig();
}

function renderCalculationDocument() {
  const content = $('doc-content');
  if (!content) return;
  content.innerHTML = CALCULATION_DOCUMENT.map((section, index) => `
    <section class="doc-section">
      <div class="doc-section-heading"><span>${String(index + 1).padStart(2, '0')}</span><h3>${escapeHtml(section.title)}</h3></div>
      <div class="doc-formulas">${section.formulas.map((formula) => `<code>${escapeHtml(formula)}</code>`).join('')}</div>
      ${section.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('')}
    </section>`).join('');
}

function openCalculationDocument() {
  renderCalculationDocument();
  $('doc-modal').hidden = false;
}

function closeCalculationDocument() {
  $('doc-modal').hidden = true;
}

function hydrateLegacySnapshot(snapshot) {
  const needsStats = snapshot.statsAvailable === false;
  const needsDamage = !snapshot.damage && currentResult?.damage;
  if (!needsStats && !needsDamage) return false;
  if (!currentResult || currentResult.hp !== snapshot.hp || currentResult.attack !== snapshot.attack) {
    calculate({ commit: true });
  }
  if (currentResult?.hp !== snapshot.hp || currentResult?.attack !== snapshot.attack) return false;
  if (needsStats) {
    snapshot.stats = { ...currentResult.stats };
    snapshot.statsAvailable = true;
  }
  if (needsDamage) snapshot.damage = currentResult.damage;
  saveConfig();
  return true;
}

function showComparisonSnapshot(index) {
  let snapshot = comparisonSnapshots[index];
  if (!snapshot) return;
  restoreSnapshotConfiguration(snapshot);
  snapshot = comparisonSnapshots[index] || snapshot;
  hydrateLegacySnapshot(snapshot);
  activeComparisonIndex = index;
  if (comparisonSnapshots.length >= 2) {
    const currentPair = normalizeComparisonPair(comparisonPair);
    const otherIndex = currentPair[1] === index ? currentPair[0] : currentPair[1];
    comparisonPair = normalizeComparisonPair([index, otherIndex]);
  }
  $('final-hp').textContent = formatNumber(snapshot.hp);
  $('final-attack').textContent = formatNumber(snapshot.attack);
  renderDamagePreview(snapshot.damage || currentResult?.damage || null);
  $('hp-detail').textContent = `方案 ${comparisonCode(index)} · 已保存快照`;
  $('attack-detail').textContent = `方案 ${comparisonCode(index)} · 已保存快照`;
  SECONDARY_KEYS.forEach((key) => {
    const domKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const value = snapshot.stats?.[key];
    $(`final-${domKey}`).textContent = value === null || value === undefined
      ? '--'
      : key === 'recovery' ? formatNumber(value) : formatSecondaryValue(key, value);
  });
  if (snapshot.statsAvailable === false) {
    $('hp-detail').textContent = `方案 ${comparisonCode(index)} · 旧快照未保存面板属性`;
    $('attack-detail').textContent = `方案 ${comparisonCode(index)} · 旧快照未保存面板属性`;
  }
  $('result-person').textContent = snapshot.roleName || '自定义角色';
  $('result-level').textContent = `等级 ${snapshot.level}`;
  saveConfig();
  renderComparison();
}

function setComparisonExpanded(expanded) {
  comparisonExpanded = Boolean(expanded);
  const section = $('comparison-section');
  const content = $('comparison-content');
  const toggle = $('comparison-toggle');
  const label = $('comparison-toggle-label');
  if (content) content.hidden = !comparisonExpanded;
  if (section) section.classList.toggle('is-expanded', comparisonExpanded);
  if (toggle) toggle.setAttribute('aria-expanded', String(comparisonExpanded));
  if (label) label.textContent = comparisonExpanded ? '收起' : '展开';
}

function renderComparison() {
  const section = $('comparison-section');
  const content = $('comparison-content');
  if (!comparisonSnapshots.length) {
    section.hidden = true;
    content.replaceChildren();
    setComparisonExpanded(false);
    return;
  }
  section.hidden = false;
  const rows = [
    { label: '生命', key: 'hp', format: formatNumber },
    { label: '攻击', key: 'attack', format: formatNumber },
    ...SECONDARY_STAT_DEFS.map((definition) => ({
      label: definition.label,
      key: `stats.${definition.key}`,
      format: (value) => formatSecondaryValue(definition.key, value),
    })),
  ];
  const valueAt = (snapshot, key) => key.startsWith('stats.')
    ? snapshot.stats?.[key.slice(6)]
    : snapshot[key];
  const formatRowValue = (row, value) => value === null || value === undefined ? '--' : row.format(value);
  const pair = normalizeComparisonPair(comparisonPair);
  comparisonPair = pair;
  const cardIndexes = [...new Set(pair.filter((index) => comparisonSnapshots[index]))];
  const cards = cardIndexes.map((index) => {
    const snapshot = comparisonSnapshots[index];
    return `
    <button class="comparison-card${activeComparisonIndex === index ? ' is-active' : ''}" type="button" data-comparison-index="${index}" aria-pressed="${activeComparisonIndex === index}">
      <strong>方案 ${comparisonCode(index)} · ${escapeHtml(snapshot.name || snapshot.roleName || '自定义角色')}</strong>
    </button>
  `;
  }).join('');
  const comparisonOptions = (selected) => comparisonSnapshots.map((snapshot, index) => `
    <option value="${index}"${index === selected ? ' selected' : ''}>方案 ${comparisonCode(index)} · ${escapeHtml(snapshot.name || snapshot.roleName || '自定义角色')}</option>
  `).join('');
  const pairControls = comparisonSnapshots.length < 2 ? '' : `
    <div class="comparison-pair-controls">
      <label>对比左侧<select id="comparison-left">${comparisonOptions(pair[0])}</select></label>
      <span>对比</span>
      <label>对比右侧<select id="comparison-right">${comparisonOptions(pair[1])}</select></label>
    </div>`;
  const table = comparisonSnapshots.length < 2
    ? '<p class="field-hint">再生成一个方案后显示差异</p>'
    : `
      <div class="comparison-table-wrap">
        <table class="compare-table">
          <thead><tr><th>属性</th><th>方案 ${comparisonCode(pair[0])} · ${escapeHtml(comparisonSnapshots[pair[0]].name || comparisonSnapshots[pair[0]].roleName || '自定义角色')}</th><th>方案 ${comparisonCode(pair[1])} · ${escapeHtml(comparisonSnapshots[pair[1]].name || comparisonSnapshots[pair[1]].roleName || '自定义角色')}</th><th>差值</th></tr></thead>
          <tbody>
            ${rows.map((row) => {
              const left = valueAt(comparisonSnapshots[pair[0]], row.key);
              const right = valueAt(comparisonSnapshots[pair[1]], row.key);
              const isText = row.type === 'text';
              const difference = isText
                ? (left === right ? '相同' : '不同')
                : left === null || left === undefined || right === null || right === undefined ? null : right - left;
              return `
                <tr>
                  <td>${row.label}</td>
                  <td>${formatRowValue(row, left)}</td>
                  <td>${formatRowValue(row, right)}</td>
                  <td class="compare-difference${!isText && difference < 0 ? ' is-negative' : ''}">${isText ? difference : difference === null ? '未保存' : `${difference > 0 ? '+' : ''}${row.format(difference)}`}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  content.innerHTML = `<div class="comparison-cards">${cards}</div>${pairControls}${table}`;
  setComparisonExpanded(comparisonExpanded);
  enhanceSelects(content);
  content.querySelectorAll('[data-comparison-index]').forEach((card) => {
    card.addEventListener('click', () => showComparisonSnapshot(Number(card.dataset.comparisonIndex)));
  });
  if (comparisonSnapshots.length >= 2) {
    $('comparison-left').addEventListener('change', (event) => {
      const next = Number(event.target.value);
      if (next === comparisonPair[1]) comparisonPair[1] = comparisonPair[0];
      comparisonPair[0] = next;
      saveConfig();
      renderComparison();
    });
    $('comparison-right').addEventListener('change', (event) => {
      const next = Number(event.target.value);
      if (next === comparisonPair[0]) comparisonPair[0] = comparisonPair[1];
      comparisonPair[1] = next;
      saveConfig();
      renderComparison();
    });
  }
  $('save-current-button').disabled = comparisonSnapshots.length >= MAX_COMPARISON_SNAPSHOTS;
}

function bindEvents() {
  ['person-name', 'hp-factor', 'power-factor', 'achievement-hp', 'achievement-attack',
    'base-speed', 'base-crit', 'base-dodge', 'base-lifesteal', 'base-crit-damage',
    'base-mitigation', 'base-block', 'base-reflect', 'base-recovery',
    'attack-pill-count', 'small-ren-attack-percent', 'large-ren-attack-count',
    'learned-s-martial-count', 'martial-bonus-percent']
    .forEach((id) => $(id).addEventListener('input', calculate));
  const handleCharacterSelection = () => {
    damageCritCustomized = false;
    applyCharacterDefaults();
    populateMartialArts();
    populateWeaponAffixes();
    populateNeigong();
    applyDefaultTechniqueSelections();
    refreshTechniqueAvailability();
    renderFormationControls();
    renderTechniqueScope();
    calculate();
  };
  // Mobile select controls can emit input before change; both events must use
  // the same path so the displayed coefficients follow the selected role.
  $('person-name').addEventListener('input', handleCharacterSelection);
  $('person-name').addEventListener('change', handleCharacterSelection);
  ['person-style', 'person-gender'].forEach((id) => $(id).addEventListener('change', () => {
    if (id === 'person-style') {
      populateMartialArts();
      populateWeaponAffixes();
    }
    populateNeigong();
    applyDefaultTechniqueSelections();
    refreshTechniqueAvailability();
    renderTechniqueScope();
    calculate();
  }));
  $('level-input').addEventListener('input', calculate);
  $('level-input').addEventListener('change', () => {
    $('level-input').value = Math.max(1, Math.min(90, Math.round(numberValue('level-input', 1))));
    calculate();
  });
  $('neigong-select').addEventListener('change', applyInnerSelection);
  $('martial-select').addEventListener('change', () => {
    damageFactorCustomized = false;
    damageCritCustomized = false;
    calculate();
  });
  $('damage-target-mitigation').addEventListener('input', () => calculate({ commit: true }));
  $('damage-factor').addEventListener('input', () => { damageFactorCustomized = true; calculate({ commit: true }); });
  $('damage-crit-adjustment').addEventListener('input', () => { damageCritCustomized = true; calculate({ commit: true }); });
  $('harem-bonus-enabled').addEventListener('change', () => {
    haremBonusCustomized = true;
    $('harem-bonus-control').classList.toggle('is-enabled', $('harem-bonus-enabled').checked);
    calculate({ commit: true });
  });
  $('technique-options').addEventListener('change', (event) => {
    const input = event.target.closest('.technique-option');
    if (!input) return;
    techniqueSelectionCustomized = true;
    if (input.checked && input.dataset.exclusiveGroup) {
      document.querySelectorAll(`.technique-option[data-exclusive-group="${input.dataset.exclusiveGroup}"]`).forEach((other) => {
        if (other !== input) other.checked = false;
      });
    }
    applyTechniqueSelection();
  });
  ['technique-hp', 'technique-attack'].forEach((id) => $(id).addEventListener('input', () => {
    setTechniqueStatsMode('manual');
    calculate();
  }));
  INNER_MANUAL_FIELD_IDS.forEach((id) => $(id).addEventListener('input', () => { setInnerStatsMode('manual'); calculate(); }));
  $('pills-enabled').addEventListener('change', calculate);
  $('attack-pills-enabled').addEventListener('change', calculate);
  $('speed-pills-enabled').addEventListener('change', calculate);
  $('small-ren-enabled').addEventListener('change', calculate);
  $('large-ren-enabled').addEventListener('change', calculate);
  $('formation-select').addEventListener('change', () => { renderFormationControls(); calculate(); });
  $('formation-position').addEventListener('change', () => { renderFormationControls(); calculate(); });
  document.querySelectorAll('.equipment-slot').forEach((select) => select.addEventListener('change', () => {
    const slotIndex = Number(select.id.split('-').pop());
    const customId = customEquipmentId(slotIndex);
    const item = getEquipment(select.value);
    if (select.value === customId) {
      const previous = state.equipmentSlots[slotIndex];
      state.equipmentSlots[slotIndex] = normalizeCustomEquipment(
        isCustomEquipmentId(previous?.id) ? previous : EMPTY_EQUIPMENT(),
        customId,
      );
    } else if (!item) {
      state.equipmentSlots[slotIndex] = EMPTY_EQUIPMENT();
    } else {
      const stats = equipmentStats(item);
      state.equipmentSlots[slotIndex] = {
        id: item.id,
        name: equipmentName(item),
        hp: stats.hp,
        attack: stats.attack,
        hpFlat: stats.hpFlat,
        attackFlat: stats.attackFlat,
        secondary: stats.secondary,
        extra: '',
      };
    }
    renderEquipmentSlots();
    calculate();
  }));
  $('equipment-slot-grid').addEventListener('input', (event) => {
    const input = event.target.closest('[data-custom-equipment-slot]');
    if (!input) return;
    const slotIndex = Number(input.dataset.customEquipmentSlot);
    const slot = state.equipmentSlots[slotIndex];
    if (!slot || !isCustomEquipmentId(slot.id)) return;
    if (input.dataset.customEquipmentSecondary) {
      slot.secondary[input.dataset.customEquipmentSecondary] = numberValueFrom(input.value);
    } else if (input.dataset.customEquipmentField === 'name') {
      slot.name = input.value;
    } else {
      slot[input.dataset.customEquipmentField] = numberValueFrom(input.value);
    }
    calculate();
  });
  $('weapon-name').addEventListener('input', (event) => {
    state.weaponName = event.target.value;
    updateWeaponSummary();
    calculate();
  });
  $('weapon-select').addEventListener('change', (event) => {
    const previousWeapon = getWhiteEquipment(state.weaponId);
    const usedBuiltInName = !String(state.weaponName || '').trim()
      || String(state.weaponName).trim() === equipmentName(previousWeapon);
    state.weaponId = event.target.value;
    state.weaponForgeOption = '';
    const item = getWhiteEquipment(state.weaponId);
    if (event.target.value === 'custom') {
      state.weaponId = '';
      state.weaponMode = 'custom';
      if (usedBuiltInName) state.weaponName = '';
    } else if (event.target.value) {
      state.weaponMode = 'builtin';
      state.weaponName = item ? equipmentName(item) : (usedBuiltInName ? '' : state.weaponName);
    } else {
      state.weaponMode = 'empty';
      state.weaponName = '';
      state.weaponAffixes = [EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX()];
    }
    renderWeaponAffixes();
    calculate();
  });
  $('weapon-forge-select').addEventListener('change', (event) => {
    state.weaponForgeOption = event.target.value;
    updateWeaponSummary();
    calculate();
  });
  state.weaponAffixes.forEach((affix, index) => {
    $(`weapon-affix-key-${index}`).addEventListener('change', (event) => { state.weaponAffixes[index].key = event.target.value; updateWeaponSummary(); calculate(); });
    $(`weapon-affix-mode-${index}`).addEventListener('change', (event) => { state.weaponAffixes[index].mode = event.target.value; updateWeaponSummary(); calculate(); });
    $(`weapon-affix-value-${index}`).addEventListener('input', (event) => { state.weaponAffixes[index].value = numberValueFrom(event.target.value); updateWeaponSummary(); calculate(); });
  });
  $('generate-button').addEventListener('click', () => {
    const result = calculate({ commit: true });
    if (result) setSaveStatus('已生成当前结果');
  });
  $('save-current-button').addEventListener('click', () => { saveCurrentCard(); });
  $('comparison-toggle').addEventListener('click', () => setComparisonExpanded(!comparisonExpanded));
  $('clear-comparison-button').addEventListener('click', () => {
    comparisonPair = normalizeComparisonPair([0, 1]);
    activeComparisonIndex = null;
    setComparisonExpanded(false);
    saveConfig();
    renderComparison();
    renderSavedCards();
    setSaveStatus('已重置对比选择，数据卡片仍保留');
  });
  $('reset-button').addEventListener('click', () => {
    state.equipmentSlots = [EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT(), EMPTY_EQUIPMENT()];
    state.weaponId = '';
    state.weaponName = '';
    state.weaponMode = 'empty';
    state.weaponForgeOption = '';
    state.weaponAffixes = [EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX(), EMPTY_WEAPON_AFFIX()];
    $('person-name').value = '主角'; $('hp-factor').value = 1; $('power-factor').value = 1;
    $('person-style').value = ''; $('person-gender').value = '';
    applyCharacterDefaults();
    populateMartialArts();
    $('base-speed').value = 0; $('base-crit').value = 10; $('base-dodge').value = 0; $('base-lifesteal').value = 0;
    $('base-crit-damage').value = 0; $('base-mitigation').value = 0; $('base-block').value = 0;
    $('base-reflect').value = 0; $('base-recovery').value = 0;
    $('achievement-hp').value = 292; $('achievement-attack').value = 292;
    $('attack-pill-count').value = 30; $('small-ren-attack-percent').value = 10;
    $('large-ren-attack-count').value = 10; $('learned-s-martial-count').value = 5;
    $('martial-bonus-percent').value = 0;
    $('damage-target-mitigation').value = 0; $('damage-factor').value = 1; $('damage-crit-adjustment').value = 0;
    damageFactorCustomized = false; damageCritCustomized = false;
    $('harem-bonus-enabled').checked = true; haremBonusCustomized = false;
    $('level-input').value = 90; $('martial-select').value = ''; $('neigong-select').value = '';
    $('neigong-level').value = 9;
    INNER_MANUAL_FIELD_IDS.forEach((id) => { $(id).value = 0; });
    setInnerStatsMode('auto');
    renderInnerEditor();
    setTechniqueSelections(defaultTechniqueIds(), { customized: false });
    $('technique-hp').value = 0; $('technique-attack').value = 0;
    setTechniqueStatsMode('manual');
    renderTechniqueScope();
    $('formation-select').value = '';
    $('formation-position').value = '1';
    renderFormationControls();
    $('pills-enabled').checked = true;
    $('attack-pills-enabled').checked = true;
    $('speed-pills-enabled').checked = true;
    $('small-ren-enabled').checked = true;
    $('large-ren-enabled').checked = true;
    activeComparisonIndex = null;
    renderWeaponAffixes(); renderEquipmentSlots(); renderComparison(); calculate();
  });

  $('doc-button').addEventListener('click', openCalculationDocument);
  $('doc-modal').addEventListener('click', (event) => {
    if (event.target === $('doc-modal')) closeCalculationDocument();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!$('confirm-modal').hidden) closeConfirmationDialog();
    else if (!$('name-modal').hidden) closeNameDialog();
    else if (!$('team-picker-modal').hidden) closeTeamPicker();
    else if (!$('team-detail-modal').hidden) closeTeamDetail();
    else if (!$('doc-modal').hidden) closeCalculationDocument();
  });
  $('create-team-button').addEventListener('click', createTeam);
  $('team-search').addEventListener('input', renderTeams);
  $('card-search').addEventListener('input', renderSavedCards);
  $('card-role-filter').addEventListener('change', renderSavedCards);
}

function bindEncyclopediaEvents() {
  $('encyclopedia-type').addEventListener('change', renderEncyclopedia);
  $('encyclopedia-martial-filter').addEventListener('change', renderEncyclopedia);
  $('encyclopedia-martial-rank-filter').addEventListener('change', renderEncyclopedia);
  $('encyclopedia-inner-rank-filter').addEventListener('change', renderEncyclopedia);
  $('encyclopedia-equipment-filter').addEventListener('change', renderEncyclopedia);
  $('encyclopedia-search').addEventListener('input', renderEncyclopedia);
  $('character-filter-bar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-character-style]');
    if (!button) return;
    characterStyleFilter = button.dataset.characterStyle || '';
    renderEncyclopedia();
  });
  $('character-sort-bar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-character-sort]');
    if (!button) return;
    const nextSort = button.dataset.characterSort || 'total';
    if (characterSort === nextSort) characterSortDirection = characterSortDirection === 'desc' ? 'asc' : 'desc';
    else {
      characterSort = nextSort;
      characterSortDirection = 'desc';
    }
    renderEncyclopedia();
  });
  $('martial-sort-bar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-martial-sort]');
    if (!button) return;
    const nextSort = button.dataset.martialSort || 'power';
    if (martialSort === nextSort) martialSortDirection = martialSortDirection === 'desc' ? 'asc' : 'desc';
    else {
      martialSort = nextSort;
      martialSortDirection = 'desc';
    }
    renderEncyclopedia();
  });
  $('inner-sort-bar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-inner-sort]');
    if (!button) return;
    const nextSort = button.dataset.innerSort || 'mitigation';
    if (innerSort === nextSort) innerSortDirection = innerSortDirection === 'desc' ? 'asc' : 'desc';
    else {
      innerSort = nextSort;
      innerSortDirection = 'desc';
    }
    renderEncyclopedia();
  });
  $('encyclopedia-list').addEventListener('click', (event) => {
    const detailButton = event.target.closest('[data-martial-detail]');
    if (detailButton) {
      event.preventDefault();
      const record = encyclopediaRecords('martial_arts').find((item) => String(item.id) === String(detailButton.dataset.martialDetail));
      openMartialDetail(record);
      return;
    }
    const button = event.target.closest('[data-encyclopedia-favorite]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = String(button.dataset.encyclopediaFavorite || '');
    if (!id) return;
    toggleEncyclopediaFavorite(id);
    const isFavorite = encyclopediaFavorites.has(id);
    button.classList.toggle('is-favorite', isFavorite);
    button.setAttribute('aria-label', `${isFavorite ? '取消收藏' : '收藏'}${button.getAttribute('aria-label')?.replace(/^(取消收藏|收藏)/, '') || ''}`);
    button.setAttribute('aria-pressed', String(isFavorite));
    const icon = button.querySelector('span[aria-hidden="true"]');
    if (icon) icon.textContent = isFavorite ? '♥' : '♡';
  });
  $('encyclopedia-detail-view').addEventListener('click', (event) => {
    if (event.target.closest('[data-encyclopedia-detail-back]')) {
      closeEncyclopediaDetail();
      return;
    }
    const button = event.target.closest('[data-encyclopedia-favorite]');
    if (!button) return;
    event.preventDefault();
    const id = String(button.dataset.encyclopediaFavorite || '');
    if (!id) return;
    toggleEncyclopediaFavorite(id);
    const record = encyclopediaRecords('martial_arts').find((item) => `martial_arts:${item.id}` === id);
    openMartialDetail(record);
  });

}

function bindDialogEvents() {
  $('name-modal-confirm').addEventListener('click', () => {
    const value = validateNameDialog();
    if (value) closeNameDialog(value);
  });
  $('name-modal-cancel').addEventListener('click', () => closeNameDialog());
  $('name-modal-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') $('name-modal-confirm').click();
    if (event.key === 'Escape') closeNameDialog();
  });
  $('name-modal').addEventListener('click', (event) => {
    if (event.target === $('name-modal')) closeNameDialog();
  });
  $('confirm-modal-cancel').addEventListener('click', closeConfirmationDialog);
  $('confirm-modal-confirm').addEventListener('click', confirmPendingAction);
  $('confirm-modal').addEventListener('click', (event) => {
    if (event.target === $('confirm-modal')) closeConfirmationDialog();
  });
  $('team-picker-modal').addEventListener('click', (event) => {
    if (event.target === $('team-picker-modal')) closeTeamPicker();
  });
  $('team-detail-modal').addEventListener('click', (event) => {
    if (event.target === $('team-detail-modal')) closeTeamDetail();
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-close-modal]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const modalId = button.dataset.closeModal;
    if (modalId === 'name-modal') closeNameDialog();
    else if (modalId === 'confirm-modal') closeConfirmationDialog();
    else if (modalId === 'team-picker-modal') closeTeamPicker();
    else if (modalId === 'team-detail-modal') closeTeamDetail();
    else if (modalId === 'doc-modal') closeCalculationDocument();
  });
  $('team-picker-role-filter').addEventListener('change', renderTeamPicker);
  $('team-picker-search').addEventListener('input', renderTeamPicker);
  $('team-picker-clear').addEventListener('click', () => {
    if (!pendingTeamPicker) return;
    const team = teams.find((item) => item.id === pendingTeamPicker.teamId);
    if (team) {
      team.slots[pendingTeamPicker.slotIndex] = null;
      team.updatedAt = Date.now();
      saveConfig();
      renderTeams();
    }
    closeTeamPicker();
  });
}

function fetchJsonWithTimeout(url, timeoutMs = 3500) {
  const request = fetch(url, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('request timeout')), timeoutMs);
  });
  return Promise.race([request, timeout]);
}

async function fetchFirstRemoteWhiteRabbitData() {
  for (const source of REMOTE_WHITE_RABBIT_URLS) {
    const url = `${source}?updated=${Date.now()}`;
    try {
      const data = await fetchJsonWithTimeout(url);
      if (whiteRabbitDataValid(data)) return data;
    } catch (error) {
      // Try the next mirror. The app must stay quiet when the network is bad.
    }
  }
  return null;
}

async function loadWhiteRabbitData() {
  if (window.JianghuContent) return (await window.JianghuContent.ready).data.encyclopedia;
  const localUrl = `${APP_DATA_BASE}whiterabbit_data.json?updated=${Date.now()}`;
  let localData = null;
  try {
    localData = await fetchJsonWithTimeout(localUrl);
  } catch (error) {
    // A broken local HTTP/file context can still recover from the cached copy.
  }
  const cachedData = readCachedWhiteRabbitData();
  return chooseWhiteRabbitData(cachedData, localData);
}

function restoreWhiteRabbitSelections(snapshot) {
  if (snapshot.characterName && [...$('person-name').options].some((option) => option.value === snapshot.characterName)) {
    $('person-name').value = snapshot.characterName;
    applyCharacterDefaults({ resetBaseStats: false });
  }
  if (snapshot.martialName) {
    const index = findWhiteMartialIndexByName(snapshot.martialName);
    $('martial-select').value = index >= 0 ? `wr-skill:${index}` : '';
  }
  if (snapshot.innerName) {
    const index = findWhiteInnerIndexByName(snapshot.innerName);
    $('neigong-select').value = index >= 0 ? `wr:${index}` : '';
  }
  if (snapshot.weaponName && state.weaponId) {
    const item = findWhiteEquipmentByName(snapshot.weaponName);
    state.weaponId = item && isWeapon(item) ? String(item.id) : '';
  }
  if (snapshot.techniqueSelectionCustomized) {
    const signatures = new Set(snapshot.techniqueSignatures);
    const ids = techniqueOptionEntries()
      .filter((item) => signatures.has(`${item.group || ''}|${item.parentName || ''}|${item.name || ''}`))
      .map((item) => item.id);
    setTechniqueSelections(ids, { customized: true });
  }
}

function applyWhiteRabbitDataUpdate(data) {
  if (!whiteRabbitDataValid(data)) return;
  if (!calculatorInitialized) {
    state.whiteRabbit = data;
    renderEncyclopedia();
    window.dispatchEvent(new CustomEvent('jianghu-white-rabbit-data-updated'));
    return;
  }
  const expandedCharacterNames = [...document.querySelectorAll('#encyclopedia-list .encyclopedia-character-card[open] h3')]
    .map((heading) => heading.textContent.trim())
    .filter(Boolean);
  const openMartialDetailName = !$('encyclopedia-detail-view')?.hidden
    ? document.querySelector('#encyclopedia-detail-view h2')?.textContent.trim()
    : '';
  const snapshot = {
    characterName: $('person-name')?.value || '',
    martialName: getSelectedMartial()?.source === 'white' ? getSelectedMartial().item?.name : '',
    innerName: getSelectedInner()?.source === 'white' ? getSelectedInner().item?.name : '',
    weaponName: state.weaponId ? equipmentName(getWhiteEquipment(state.weaponId)) : '',
    techniqueSelectionCustomized,
    techniqueMode: techniqueStatsMode(),
    techniqueSignatures: selectedTechniques().map((item) => `${item.group || ''}|${item.parentName || ''}|${item.name || ''}`),
  };
  state.whiteRabbit = data;
  populateCharacterPresets();
  populateNeigong();
  populateMartialArts();
  populateTechniques();
  populateWeaponAffixes();
  techniqueSelectionCustomized = snapshot.techniqueSelectionCustomized;
  restoreWhiteRabbitSelections(snapshot);
  setTechniqueStatsMode(snapshot.techniqueMode);
  if (innerStatsMode() === 'auto') syncAutoInnerStats();
  if (techniqueStatsMode() === 'auto') syncTechniqueStats();
  renderTechniqueScope();
  renderWeaponAffixes();
  renderEquipmentSlots();
  renderSavedCards();
  renderTeams();
  renderEncyclopedia();
  expandedCharacterNames.forEach((name) => {
    const card = [...document.querySelectorAll('#encyclopedia-list .encyclopedia-character-card')]
      .find((item) => item.querySelector('h3')?.textContent.trim() === name);
    if (card) card.open = true;
  });
  if (openMartialDetailName) {
    const record = encyclopediaRecords('martial_arts')
      .find((item) => item.name === openMartialDetailName);
    if (record) openMartialDetail(record);
  }
  refreshSelectProxies();
  calculate();
  window.dispatchEvent(new CustomEvent('jianghu-white-rabbit-data-updated'));
}

async function refreshWhiteRabbitDataInBackground() {
  const remoteData = await fetchFirstRemoteWhiteRabbitData();
  if (!whiteRabbitDataValid(remoteData)) return;
  const baseline = state.whiteRabbit;
  if (baseline && compareWhiteRabbitData(remoteData, baseline) < 0) return;
  saveCachedWhiteRabbitData(remoteData);
  if (whiteRabbitSignature(remoteData) !== whiteRabbitSignature(baseline)) {
    applyWhiteRabbitDataUpdate(remoteData);
  }
}

async function initializeApp(retry) {
  startupError = '';
  window.JianghuContent?.showStartupStatus(retry ? '正在重新加载数据…' : '正在读取数据…', true);
  try {
    const baseRequest = startupBaseData ? Promise.resolve(startupBaseData) : (window.JianghuContent
        ? window.JianghuContent.readJsonAsset(`${APP_DATA_BASE}uc540_doc.json`)
        : fetch(`${APP_DATA_BASE}uc540_doc.json`, { cache: 'no-store' }).then((response) => {
          if (!response.ok) throw new Error(`数据读取失败（HTTP ${response.status}）`);
          return response.json();
        })).then((data) => {
          if (!data?.personHp || !data?.personPower || !data?.skill || !data?.neiGong || !data?.equip) {
            throw new Error('计算器基础数据不完整');
          }
          startupBaseData = data;
          return data;
        });
    const contentRequest = (retry && window.JianghuContent
      ? window.JianghuContent.retryLoad().then((bundle) => bundle.data.encyclopedia)
      : loadWhiteRabbitData()).then((data) => {
        if (!whiteRabbitDataValid(data)) throw new Error('图鉴数据不完整');
        state.whiteRabbit = data;
        renderEncyclopedia();
        window.dispatchEvent(new CustomEvent('jianghu-encyclopedia-ready'));
        return data;
      });
    // The encyclopedia becomes usable immediately, independently of calculator assets.
    const [baseResult, contentResult] = await Promise.allSettled([
      baseRequest, contentRequest,
    ]);
    if (contentResult.status === 'rejected') throw contentResult.reason;
    if (baseResult.status === 'rejected') throw baseResult.reason;
    state.data = baseResult.value;
    startupDisabledControls.forEach((disabled, control) => { control.disabled = disabled; });
    populate();
    if (!calculatorEventsBound) {
      bindEvents(); bindDialogEvents();
      calculatorEventsBound = true;
    }
    restoreConfig();
    if (innerStatsMode() === 'auto') syncAutoInnerStats();
    if (techniqueStatsMode() === 'auto') syncTechniqueStats();
    renderTechniqueScope();
    renderWeaponAffixes(); renderEquipmentSlots(); enhanceSelects(); refreshSelectProxies();
    calculatorInitialized = true;
    calculate();
    setError('');
    window.dispatchEvent(new CustomEvent('jianghu-app-ready'));
    if (!window.JianghuContent) {
      refreshWhiteRabbitDataInBackground().catch((error) => console.warn('图鉴数据自动更新失败', error));
    }
    return true;
  } catch (error) {
    calculatorInitialized = false;
    state.data = null;
    const message = state.whiteRabbit
      ? `计算器加载失败：${error.message}。图鉴和攻略仍可使用，点击检查数据更新重试。`
      : `数据加载失败：${error.message}。点击检查数据更新重试。`;
    setError(message);
    startupError = message;
    window.JianghuContent?.showStartupStatus('');
    document.querySelectorAll('#calculator-view input, #calculator-view select, #calculator-view button').forEach((control) => { control.disabled = true; });
    return false;
  }
}

function init(retry = false) {
  if (startupPending) return startupPending;
  if (calculatorInitialized) return Promise.resolve(true);
  startupPending = initializeApp(retry).finally(() => { startupPending = null; });
  return startupPending;
}

window.addEventListener('jianghu-content-updated', (event) => {
  applyWhiteRabbitDataUpdate(event.detail.data.encyclopedia);
});

const startupDisabledControls = new Map([...document.querySelectorAll('#calculator-view input, #calculator-view select, #calculator-view button')]
  .map((control) => [control, control.disabled]));
startupDisabledControls.forEach((disabled, control) => { control.disabled = true; });
bindEncyclopediaEvents();
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
window.jianghuApp = { retryStartup: () => init(true), get initialized() { return calculatorInitialized; }, get startupError() { return startupError; } };
init();
