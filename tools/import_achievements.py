"""Import the achievement checklist without changing encyclopedia statistics."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

import openpyxl

CATEGORIES = [('拳', 'fist', '拳法'), ('剑', 'sword', '剑法'), ('刀', 'blade', '刀法'),
              ('棍', 'staff', '棍法'), ('内功', 'inner', '内功'), ('技艺', 'technique', '技艺')]


def convert(source, previous):
    book = openpyxl.load_workbook(source, read_only=True, data_only=True)
    records = []
    for sheet, category, label in CATEGORIES:
        rows = [list(row) for row in book[sheet].iter_rows(values_only=True) if any(v is not None for v in row)]
        expected = ['名称', '最高等级'] if category == 'technique' else ['名称', '等级', '获取途径']
        if rows[0] != expected:
            raise ValueError(f'Unexpected columns: {sheet}')
        counts = Counter(str(row[0]).strip() for row in rows[1:])
        for row in rows[1:]:
            name = str(row[0]).strip()
            rank = str(row[1]).strip().replace('？', '?') if category != 'technique' else ''
            matches = [item for item in previous if item['category'] == category and item['title'] == name]
            if len(matches) > 1:
                matches = [item for item in matches if item.get('rank') == rank]
            identity = f'{category}:{name}' + (f':{rank}' if counts[name] > 1 else '')
            identifier = matches[0]['id'] if len(matches) == 1 else 'collect-' + hashlib.sha256(identity.encode()).hexdigest()[:16]
            access = str(row[2] or '').strip() if len(row) > 2 else ''
            item = {'id': identifier, 'category': category, 'title': name,
                    'access': access, 'available': '暂未开放' not in access}
            if category == 'technique':
                item['maxLevel'] = int(row[1])
            else:
                item['rank'] = rank
            records.append(item)
    if len({item['id'] for item in records}) != len(records):
        raise ValueError('Duplicate achievement identifiers')
    return {'categories': [{'id': key, 'title': label} for _, key, label in CATEGORIES], 'records': records}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'web/achievements.json')
    args = parser.parse_args()
    previous = json.loads(args.output.read_text())['records'] if args.output.exists() else []
    data = convert(args.source, previous)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f"Imported {len(data['records'])} records; {sum(not item['available'] for item in data['records'])} unavailable")
