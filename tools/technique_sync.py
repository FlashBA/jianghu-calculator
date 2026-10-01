"""Strict technique effect parsing; unknown mechanics never become guessed stats."""
import copy
import re

SECONDARY = {'闪避': 'dodge', '速度': 'speed', '暴击率': 'crit', '暴击': 'crit',
             '暴击伤害': 'critDamage', '爆伤': 'critDamage', '免伤': 'mitigation',
             '恢复': 'recovery', '回复': 'recovery', '格挡': 'block', '招架': 'block',
             '反伤': 'reflect', '吸血': 'lifesteal'}
CALC_KEYS = ('hp_percent', 'attack_percent', 'secondary', 'recovery_base_percent', 'choices', 'calculate')


def fingerprint(item):
    return {key: copy.deepcopy(item[key]) for key in CALC_KEYS if key in item}


def parse_effect(text, name):
    result = {'hp_percent': None, 'attack_percent': None, 'secondary': {}}
    sign = 1
    seen = set()
    for token in re.split(r'[，,、；;\n]+', re.sub(r'\s+', '', text)):
        if token == '每次进入战斗免疫首段伤害' and name == '横练护体气功':
            continue
        match = re.fullmatch(r'(增加|提高|提升|降低|减少)?([+-]?\d+(?:\.\d+)?)(%?)(.+)', token)
        if not match:
            raise ValueError('Unrecognized technique clause: ' + token)
        verb, number, unit, attribute = match.groups()
        if verb:
            sign = -1 if verb in ('降低', '减少') else 1
        value = float(number) * sign
        if abs(value) > 1000:
            raise ValueError('Technique value outside supported range')
        if attribute in seen:
            raise ValueError('Repeated technique attribute')
        seen.add(attribute)
        if attribute == '速度' and unit:
            raise ValueError('Percentage speed needs explicit rules')
        if attribute != '速度' and not unit:
            raise ValueError('Missing percent unit')
        if attribute in ('基础气血', '气血', '生命', '生命值'):
            result['hp_percent'] = value
        elif attribute == '攻击':
            result['attack_percent'] = value
        elif attribute in SECONDARY:
            result['secondary'][SECONDARY[attribute]] = value
        elif attribute in ('拳脚威力', '剑法威力', '刀法威力', '棍法威力', '棍法伤害'):
            if value < 0:
                raise ValueError('Negative style power needs client support')
            # The client derives these values from the same effect text.
            continue
        else:
            raise ValueError('Unknown technique attribute: ' + attribute)
    if name == '玄武之力':
        result['recovery_base_percent'] = result['secondary'].pop('recovery', 0)
    return result


def can_link(item):
    if item.get('choices') or item.get('calculate') is False:
        raise ValueError('Conditional/choice technique requires review')
    parsed = parse_effect(item['effect'], item['name'])
    for key in ('hp_percent', 'attack_percent', 'recovery_base_percent'):
        if (item.get(key) or 0) != (parsed.get(key) or 0):
            raise ValueError('Manual numeric override: ' + key)
    for key, value in item.get('secondary', {}).items():
        if value != parsed['secondary'].get(key, 0):
            raise ValueError('Manual secondary override: ' + key)
    return parsed


def linked_update(before, after):
    can_link(before)
    parsed = parse_effect(after['effect'], after['name'])
    after.update(parsed)
    # Explicit zeroes suppress stale fallback parsing and preserve removed stats.
    keys = set(before.get('secondary', {})) | set(can_link(before)['secondary'])
    for key in keys:
        after['secondary'].setdefault(key, 0)
