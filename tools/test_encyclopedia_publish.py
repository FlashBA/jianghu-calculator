import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import compare_tencent_encyclopedia as sync
import publish_tencent_encyclopedia as publisher
import technique_sync
import content_parts


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'private'
        self.public = Path(self.temp.name) / 'public'
        self.public.mkdir()
        self.bundle = json.loads((sync.ROOT / 'web/content_bundle.json').read_bytes())
        self.data = self.bundle['data']['encyclopedia']
        publisher.atomic(self.public / 'content_bundle.json', self.bundle)
        publisher.atomic(self.public / 'content_manifest.json', {'schemaVersion': 1, 'revision': self.bundle['revision'],
            'file': 'content_bundle.json', 'sha256': hashlib.sha256(publisher.encoded(self.bundle)).hexdigest()})
        publisher.atomic(self.public / 'whiterabbit_data.json', self.data)
        self.cloud = {}
        for name in ('音律', '佛法禅理', '玄武之力'):
            item = next(i for i in self.data['techniques'] if i['name'] == name)
            self.cloud['techniques:' + name] = {'category': 'techniques', 'name': name, 'values':
                {k: item[k] for k in sync.MAPPINGS['techniques']}, 'sheet': '技艺获取与升级', 'row': 10, 'invalid': []}
        self.cloud['techniques:佛法禅理']['values']['effect'] = '25%基础气血，-5%暴击率'
        self.sources = [{'url': 'fixture', 'sheet_id': 'fixture', 'revision': 1}]
        publisher.publish(self.root, self.public, self.cloud, self.sources, [], initialize=True)

    def snapshot(self):
        return {str(p.relative_to(self.public)): p.read_bytes() for p in self.public.rglob('*') if p.is_file()}

    def test_noop_dry_run_then_linked_publish(self):
        before = self.snapshot()
        self.assertFalse(publisher.publish(self.root, self.public, self.cloud, self.sources, [])['published'])
        self.assertEqual(before, self.snapshot())
        self.cloud['techniques:音律']['values']['effect'] = '7%闪避，8速度，9%攻击'
        self.cloud['techniques:玄武之力']['values']['effect'] = '12%恢复，10%格挡，15%基础气血'
        self.cloud['techniques:佛法禅理']['values']['effect'] = '99%基础气血，50%暴击率'
        status = publisher.publish(self.root, self.public, self.cloud, self.sources, [], check_only=True)
        self.assertTrue(status['would_publish'])
        self.assertEqual(before, self.snapshot())
        status = publisher.publish(self.root, self.public, self.cloud, self.sources, [])
        self.assertTrue(status['published'])
        bundle, _ = publisher.read_public(self.public)
        data = bundle['data']['encyclopedia']
        flute = next(x for x in data['techniques'] if x['name'] == '音律')
        self.assertEqual(flute['attack_percent'], 9)
        self.assertEqual(flute['secondary'], {'dodge': 7, 'speed': 8})
        buddha = next(x for x in data['techniques'] if x['name'] == '佛法禅理')
        self.assertEqual(buddha['secondary']['crit'], -5)
        turtle = next(x for x in data['techniques'] if x['name'] == '玄武之力')
        self.assertEqual(turtle['recovery_base_percent'], 12)
        self.assertEqual(turtle['hp_percent'], 15)
        self.assertNotIn('recovery', turtle['secondary'])
        for key in ('equipment', 'dungeon_drops'):
            self.assertEqual(data[key], self.data[key])
        for key in self.bundle['data']:
            if key != 'encyclopedia':
                self.assertEqual(bundle['data'][key], self.bundle['data'][key])
        self.assertEqual(data, json.loads((self.public / 'whiterabbit_data.json').read_bytes()))
        parts = json.loads((self.public / 'content_manifest_v2.json').read_bytes())
        self.assertEqual(parts['revision'], bundle['revision'])
        for part in parts['parts'].values():
            self.assertEqual(hashlib.sha256((self.public / part['file']).read_bytes()).hexdigest(), part['sha256'])

    def test_unknown_effect_keeps_text_and_stats(self):
        self.cloud['techniques:音律']['values']['effect'] = '每次暴击随机提高攻击'
        status = publisher.publish(self.root, self.public, self.cloud, self.sources, [])
        self.assertFalse(status['published'])
        self.assertEqual(len(status['review']), 1)

    def test_split_publication_and_manifest_recovery(self):
        initial, _ = publisher.read_public(self.public)
        old_manifest, _ = content_parts.describe(initial)
        self.cloud['techniques:音律']['values']['effect'] = '7%闪避，8速度，9%攻击'
        with patch.object(content_parts, 'publish_manifest', side_effect=OSError('interrupted v2 manifest')):
            with self.assertRaises(OSError):
                publisher.publish(self.root, self.public, self.cloud, self.sources, [])
        self.assertTrue((self.root / 'encyclopedia-pending.json').exists())
        publisher.recover(self.root, self.public)
        latest = json.loads((self.public / 'content_manifest_v2.json').read_bytes())
        changed = [key for key in latest['parts'] if latest['parts'][key] != old_manifest['parts'][key]]
        self.assertEqual(changed, ['encyclopedia'])
        self.assertFalse((self.root / 'encyclopedia-pending.json').exists())

    def test_failed_transaction_recovers(self):
        self.cloud['techniques:音律']['values']['effect'] = '7%闪避，8速度，9%攻击'
        original = publisher.atomic
        def fail_manifest(path, value):
            if path == self.public / 'content_manifest.json':
                raise OSError('simulated interruption')
            original(path, value)
        with patch.object(publisher, 'atomic', fail_manifest):
            with self.assertRaises(OSError):
                publisher.publish(self.root, self.public, self.cloud, self.sources, [])
        self.assertTrue((self.root / 'encyclopedia-pending.json').exists())
        publisher.recover(self.root, self.public)
        publisher.read_public(self.public)
        self.assertFalse((self.root / 'encyclopedia-pending.json').exists())
        self.assertFalse(publisher.publish(self.root, self.public, self.cloud, self.sources, [])['published'])

    def test_bad_source_and_reinitialization_do_not_publish(self):
        before = self.snapshot()
        with self.assertRaises(ValueError):
            publisher.publish(self.root, self.public, self.cloud, self.sources, [], initialize=True)
        with self.assertRaises(ValueError):
            publisher.publish(self.root, self.public, self.cloud, self.sources, ['invalid cell'])
        with self.assertRaises(ValueError):
            publisher.publish(self.root, self.public, self.cloud, [{**self.sources[0], 'revision': 0}], [])
        self.assertEqual(before, self.snapshot())

    def test_negative_effect_and_removed_stat(self):
        parsed = technique_sync.parse_effect('降低6%暴击率，6%暴击伤害，6%气血', '赌术')
        self.assertEqual(parsed['hp_percent'], -6)
        self.assertEqual(parsed['secondary']['critDamage'], -6)
        old = {'name': '测试', 'effect': '10%爆伤，5%攻击', 'attack_percent': 5}
        new = {**old, 'effect': '7%攻击'}
        technique_sync.linked_update(old, new)
        self.assertEqual(new['secondary']['critDamage'], 0)
        self.assertEqual(new['attack_percent'], 7)


if __name__ == '__main__':
    unittest.main()
