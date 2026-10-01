#!/usr/bin/env python3
"""Publish four encyclopedia categories, preserving all other live content."""
import argparse
import copy
import fcntl
import hashlib
import json
import os
import shutil
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import compare_tencent_encyclopedia as sync
import content_parts

CATEGORIES = ('characters', 'techniques', 'inner_skills', 'martial_arts')


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()


def atomic(path, value):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as output:
        output.write(encoded(value))
        output.flush()
        os.fsync(output.fileno())
        temporary = Path(output.name)
    temporary.chmod(0o644)
    temporary.replace(path)


def read_public(public):
    raw = (public / 'content_bundle.json').read_bytes()
    bundle = json.loads(raw)
    manifest = json.loads((public / 'content_manifest.json').read_bytes())
    if (bundle.get('schemaVersion') != 1 or manifest.get('schemaVersion') != 1
            or manifest.get('file') != 'content_bundle.json'
            or manifest.get('revision') != bundle.get('revision')
            or manifest.get('sha256') != hashlib.sha256(raw).hexdigest()):
        raise ValueError('Published bundle checksum/revision mismatch')
    for category in CATEGORIES:
        if not isinstance(bundle['data']['encyclopedia'][category], list) or not bundle['data']['encyclopedia'][category]:
            raise ValueError('Missing published category: ' + category)
    return bundle, manifest


def recover(root, public):
    journal = root / 'encyclopedia-pending.json'
    if not journal.exists():
        return
    transaction = json.loads(journal.read_bytes())
    current_manifest = json.loads((public / 'content_manifest.json').read_bytes())
    target_revision = transaction['manifest']['revision']
    if current_manifest['revision'] > target_revision:
        # A later guide publication may already have reused the committed data.
        current, _ = read_public(public)
        if current['data']['encyclopedia'] != transaction['encyclopedia']:
            raise ValueError('A newer manual publication conflicts with pending transaction')
    else:
        split_manifest = content_parts.prepare(public, transaction['bundle'])
        transaction['manifest']['sha256'] = hashlib.sha256(encoded(transaction['bundle'])).hexdigest()
        atomic(public / 'whiterabbit_data.json', transaction['encyclopedia'])
        atomic(public / 'content_bundle.json', transaction['bundle'])
        atomic(public / 'content_manifest.json', transaction['manifest'])
        content_parts.publish_manifest(public, split_manifest)
    if current_manifest['revision'] > target_revision:
        content_parts.publish_manifest(public, content_parts.prepare(public, current))
    atomic(root / 'encyclopedia-baseline.json', transaction['baseline'])
    journal.unlink()


def validate_sources(sources, previous):
    if previous is None:
        return
    old = {(s['url'], s['sheet_id']): s for s in previous['sources']}
    for source in sources:
        key = (source['url'], source['sheet_id'])
        if key not in old or source['revision'] < old[key]['revision']:
            raise ValueError('Source binding changed or revision regressed')
        # Protobuf styling can change without changing cell data; the parsed
        # field baseline is authoritative, not byte-for-byte transport identity.


def publish(root, public, cloud, sources, issues, initialize=False, seed=None, check_only=False):
    root.mkdir(parents=True, exist_ok=True)
    with (root / 'publish.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if not check_only:
            recover(root, public)
        elif (root / 'encyclopedia-pending.json').exists():
            raise ValueError('Pending publication requires recovery first')
        bundle, manifest = read_public(public)
        baseline_path = root / 'encyclopedia-baseline.json'
        previous = json.loads(baseline_path.read_bytes()) if baseline_path.exists() else None
        if initialize and previous:
            raise ValueError('Baseline exists; refusing to reinitialize protected fields')
        if not initialize and not previous:
            raise ValueError('Initialize baseline before enabling timer')
        validate_sources(sources, previous)
        if issues:
            raise ValueError('Source has unsupported fields; publication retained: ' + str(issues[:3]))
        current = bundle['data']['encyclopedia']
        local = copy.deepcopy(current)
        if seed:
            if not initialize:
                raise ValueError('Seed only allowed during initialization')
            for category in CATEGORIES:
                local[category] = copy.deepcopy(seed[category])
        candidate, records, changes = sync.compare(local, cloud, previous['records'] if previous else None)
        if any(candidate.get(k) != current.get(k) for k in current if k not in CATEGORIES):
            raise ValueError('Attempt to change unowned data')
        for category in CATEGORIES:
            names = [sync.normalized(item['name']) for item in candidate[category]]
            if len(set(names)) != len(names) or len(candidate[category]) < len(local[category]):
                raise ValueError('Duplicate or deleted items')
        changed = candidate != current
        now = datetime.now(timezone.utc)
        baseline = {'schema_version': 1, 'sources': sources, 'records': records}
        status = {'checked_at': now.isoformat(), 'published': False, 'would_publish': changed,
                  'counts': dict(Counter(c['status'] for c in changes)),
                  'review': [c for c in changes if c['status'] == 'review'],
                  'content_revision': bundle['revision'], 'categories': list(CATEGORIES)}
        if check_only:
            return status
        if changed:
            # Preserve current guides and latest pitfalls even when the two jobs
            # fetched Tencent simultaneously; only mutate under their shared lock.
            candidate.setdefault('source', {})['synced_at'] = now.isoformat()
            bundle['data']['encyclopedia'] = candidate
            bundle['revision'] = max(bundle['revision'] + 1, int(now.timestamp() * 1000))
            bundle['generatedAt'] = now.isoformat()
            manifest.update(revision=bundle['revision'], sha256=hashlib.sha256(encoded(bundle)).hexdigest())
            backup = root / 'encyclopedia-backups' / str(bundle['revision'])
            backup.mkdir(parents=True)
            for name in ('content_bundle.json', 'content_manifest.json', 'whiterabbit_data.json'):
                shutil.copy2(public / name, backup / name)
            if baseline_path.exists():
                shutil.copy2(baseline_path, backup / baseline_path.name)
            atomic(root / 'encyclopedia-pending.json', {'bundle': bundle, 'manifest': manifest,
                   'encyclopedia': candidate, 'baseline': baseline})
            recover(root, public)
            status.update(published=True, content_revision=bundle['revision'])
        else:
            atomic(baseline_path, baseline)
        atomic(root / 'encyclopedia-status.json', status)
        return status


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/opt/jianghu-content-sync'))
    parser.add_argument('--public', type=Path, default=Path('/opt/jianghu-calculator/releases'))
    parser.add_argument('--initialize', action='store_true')
    parser.add_argument('--seed', type=Path)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    try:
        if not args.check_only:
            args.root.mkdir(parents=True, exist_ok=True)
            with (args.root / 'publish.lock').open('w') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                recover(args.root, args.public)
        # Isolated fetches avoid partial snapshots being reused after a failure.
        with tempfile.TemporaryDirectory(prefix='jianghu-encyclopedia-') as temporary:
            folder = Path(temporary)
            sync.fetch_snapshots(folder)
            cloud, sources, issues = sync.read_cloud(folder)
            result = publish(args.root, args.public, cloud, sources, issues, args.initialize,
                             json.loads(args.seed.read_bytes()) if args.seed else None, args.check_only)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        args.root.mkdir(parents=True, exist_ok=True)
        if not args.check_only:
            atomic(args.root / 'encyclopedia-status.json', {'checked_at': datetime.now(timezone.utc).isoformat(),
                   'published': False, 'error': str(error)})
        raise


if __name__ == '__main__':
    main()
