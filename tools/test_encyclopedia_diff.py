import copy
import unittest

from compare_tencent_encyclopedia import compare, convert, dungeon_records


class BaselineTests(unittest.TestCase):
    def setUp(self):
        self.local = {'characters': [], 'techniques': [], 'inner_skills': [], 'martial_arts': [
            {'name': 'test', 'power': 100, 'crit_damage': '2.4/2.5/2.6'},
        ]}
        self.cloud = {'martial_arts:test': {'category': 'martial_arts', 'name': 'test',
            'values': {'name': 'test', 'power': 100, 'crit_damage': '2.5/2.8/3'},
            'sheet': '剑法篇', 'row': 6, 'invalid': []}}

    def test_initial_diff_then_cloud_update_and_sticky_override(self):
        original = copy.deepcopy(self.local)
        candidate, baseline, _ = compare(self.local, self.cloud)
        self.assertEqual(candidate, original)
        self.assertEqual(baseline['martial_arts:test']['fields']['crit_damage']['mode'], 'local')
        self.cloud['martial_arts:test']['values'].update(power=120, crit_damage=5)
        candidate, baseline, _ = compare(candidate, self.cloud, baseline)
        self.assertEqual(candidate['martial_arts'][0]['power'], 120)
        self.assertEqual(candidate['martial_arts'][0]['crit_damage'], '2.4/2.5/2.6')
        candidate['martial_arts'][0]['power'] = 130
        self.cloud['martial_arts:test']['values']['power'] = 140
        candidate, baseline, _ = compare(candidate, self.cloud, baseline)
        self.assertEqual(candidate['martial_arts'][0]['power'], 130)
        self.assertEqual(baseline['martial_arts:test']['fields']['power']['mode'], 'local')
        self.assertEqual(self.local, original)

    def test_new_martial_arts_are_appended_once_after_baseline(self):
        _, baseline, _ = compare(self.local, self.cloud)
        self.cloud['martial_arts:new'] = {'category': 'martial_arts', 'name': 'new',
            'values': {'name': 'new', 'rank': 'S', 'power': 200, 'speed': 100, 'range': '随1', 'access': '任务'},
            'sheet': '剑法篇', 'row': 8, 'invalid': []}
        initial, _, _ = compare(self.local, self.cloud)
        self.assertEqual(len(initial['martial_arts']), 1)
        candidate, next_baseline, _ = compare(self.local, self.cloud, baseline)
        self.assertEqual(len(candidate['martial_arts']), 2)
        again, _, _ = compare(candidate, self.cloud, next_baseline)
        self.assertEqual(len(again['martial_arts']), 2)
        self.cloud['martial_arts:new']['invalid'] = ['power']
        incomplete, _, _ = compare(self.local, self.cloud, baseline)
        self.assertEqual(len(incomplete['martial_arts']), 1)

    def test_cloud_deletion_keeps_local(self):
        _, baseline, _ = compare(self.local, self.cloud)
        candidate, _, changes = compare(self.local, {}, baseline)
        self.assertEqual(candidate, self.local)
        self.assertEqual(changes[0]['status'], 'local_only')

    def test_equivalent_whitespace_and_float_do_not_publish(self):
        self.local['martial_arts'][0]['special'] = 'same  text'
        self.local['martial_arts'][0]['power'] = 28.000000000000004
        self.cloud['martial_arts:test']['values'].update(special='same text', power=28)
        _, baseline, _ = compare(self.local, self.cloud)
        candidate, _, _ = compare(self.local, self.cloud, baseline)
        self.assertEqual(candidate, self.local)

    def test_percent_and_segment_conversion(self):
        self.assertEqual(convert('crit_percent', .05), 5)
        self.assertEqual(convert('crit_percent', '5%'), 5)
        self.assertEqual(convert('crit_damage', '2.4/2.5/2.6'), '2.4/2.5/2.6')
        with self.assertRaises(ValueError):
            convert('power', '待测')

    def test_dungeon_cells_keep_drop_columns_and_multiple_items(self):
        snapshot = {'sheet_name': '副本掉落', 'rows': {
            '1': {'1': '囚龙谷（重置500元宝）'},
            '2': {'2': 'BOSS', '5': '宝箱掉落', '7': '飘字掉落', '9': '飘字掉落概率'},
            '3': {'1': '外围', '2': '蔷薇剑仙 花照影', '5': '藏宝图碎片',
                  '7': 'S百花功 S蔷薇心经', '9': '10%，5%'},
        }}
        records, issues = dungeon_records(snapshot)
        self.assertFalse(issues)
        by_name = {r['name']: r['values'] for r in records.values()}
        self.assertEqual(len(by_name), 3)
        self.assertEqual(by_name['藏宝图碎片']['drop'], '宝箱掉落')
        self.assertEqual(by_name['S百花功']['item_probability'], '10%')
        self.assertEqual(by_name['S蔷薇心经']['item_probability'], '5%')
        snapshot['rows']['4'] = {'2': '新增Boss', '7': '新掉落', '9': .2}
        records, _ = dungeon_records(snapshot)
        self.assertEqual(next(r['values']['item_probability'] for r in records.values() if r['name'] == '新掉落'), '20%')
        snapshot['rows']['2']['5'] = '未知列'
        with self.assertRaises(ValueError):
            dungeon_records(snapshot)


if __name__ == '__main__':
    unittest.main()
