# 图鉴字段同步基线

最新约定：副本掉落暂时手动维护，不接入自动同步。已有副本快照和报告仅用于
人工参考，默认下载/对比命令不读取副本表；需要手动复核时显式加
`--include-dungeons`。不会自动修改或发布副本数据。

## 用户确认的规则

首次按字段比较本地与腾讯文档：不同的字段永久以当前本地值为准；一致的字段
建立跟随基线，以后云端修改时可以同步。跟随期间若本地又发生人工修改，该字段
转为本地优先。云端以后碰巧改成同值，也不自动解除本地优先。

云端在基线之后新增的武学，字段校验通过后允许追加，不需要新 APK。首次已在
云端但不在本地的条目不当作新追加，先保留差异以免名称别字导致重复。
云端删除不删除本地条目；重命名需要明确映射，不用模糊匹配猜测。

## 离线工具

```sh
# 默认下载七张工作表（不含副本）；不改应用数据。
python3 tools/compare_tencent_encyclopedia.py --fetch

# 完全离线首次对比，生成报告和基线候选。
python3 tools/compare_tencent_encyclopedia.py

# 后续快照与已保留的基线比较，仍只生成候选，不发布。
python3 tools/compare_tencent_encyclopedia.py \
  --baseline /path/to/previous-baseline.json --output /path/to/next-report

python3 tools/test_encyclopedia_diff.py
```

默认输出 `reports/tencent-encyclopedia-diff/`：

- `diff.md`：人工查看的字段差异。
- `diff.json`：完整差异、来源版本及未映射范围。
- `baseline-candidate.json`：字段跟随/本地优先状态。
- `encyclopedia-candidate.json`：按规则合并的离线候选。

快照与报告保留在本地，当前忽略规则不会把它们上传 GitHub。
首次对比不修改图鉴任何值。只有实际发布成功，才能把候选基线作为下一次的基线；
不能在试算或发布失败时推进。旧基线和发布备份必须留存。

当前覆盖随从、技艺原文、四类武学、内功、副本掉落的明确表格字段。忽略文字空白和浮点
尾差，其余不同均保留本地，不通过语义猜测判断相同。
两个腾讯文档的工作表目录中均没有独立装备表，装备继续保留本地。副本按坐标
读取 Boss、宝箱、飘字和概率，不使用旧脚本的固定 RAW_ROWS；补充备注中的额外
宝箱条目、数量不匹配的概率单列待处理，不猜测补齐。

## 线上任务（2026-10-02 已启用）

`jianghu-encyclopedia-sync.timer` 每天北京时间 04:10 运行，独立于
原避坑任务。范围仅随从、技艺、内功、武学；不修改装备、副本和攻略。
当前基线有 1705 个可跟随字段、63 个本地优先字段；另有名称未匹配条目，
继续保留，不猜测合并。基线不能反复初始化，否则会丢失人工保护历史。

`technique_sync.py` 联动更新效果文字、生命、攻击和附加属性，并对玄武之力
使用基础生命回复规则。当前 43 条技艺中 39 条的现有写法可解析；卧龙心诀、
寂雪斩、百分比速度写法的酒量、任督二脉不能按通用属性解析。这些条件效果
以及今后未识别的新写法，保留旧效果和计算属性，在状态文件中列出待核对项。
首次文字不同的效果仍按本地优先，不因解析器认为同义而解除保护。
新武学支持现有数据结构，新增计算机制仍需客户端支持，不自动生成算法。

脚本目录 `/opt/jianghu-content-sync`；基线 `encyclopedia-baseline.json`；
最近状态 `encyclopedia-status.json`；备份 `encyclopedia-backups/`。
发布器在共享 `publish.lock` 内读取线上最新包，仅替换负责字段，并同步
`whiterabbit_data.json`，最后发布 manifest 与基线。中断事务记录在
`encyclopedia-pending.json`，下一次运行先恢复；采集失败不替换数据。
数据未变化时不推进内容版本，也不因空格或浮点尾差重复发布。

```sh
# 避坑和四类图鉴都检查并发布符合规则的更新。
ssh root@47.95.250.113 jianghu-check-updates
# 只运行四类图鉴任务。
ssh root@47.95.250.113 jianghu-check-updates --encyclopedia
# 只读取对比，不修改发布文件或基线。
ssh root@47.95.250.113 jianghu-check-updates --check-only
```

已验证：技艺计算联动、保护字段、新武学追加、异常效果保留、发布中断恢复；
线上连续两次检查无变化且版本不变。定时任务发布至阿里云；GitHub 仍是手动
发布时同步的备用快照，无 GitHub 自动写入凭据。本次最新数据已同步 main/Pages，
未打包或发布 v0.5 APK。

## 已核实的来源绑定

| 图鉴类别 | 文档 | 工作表 ID / 名称 |
| --- | --- | --- |
| 角色（随从） | DSWJSVEVGc1Z6Q21E | BB08J2 / 角色成长与天赋 |
| 技艺 | DSWJSVEVGc1Z6Q21E | mgdudc / 技艺获取与升级 |
| 副本掉落 | DSWJSVEVGc1Z6Q21E | w5z6in / 副本掉落 |
| 武学 | DSURIZEVDYVZjdHRp | BB08J2 / 拳法篇；3ckc51 / 剑法篇；so0fll / 刀法篇；uu9vca / 棍法篇 |
| 内功 | DSURIZEVDYVZjdHRp | 3n2nwv / 内功篇 |

“来源已绑定/已离线比对”和“服务器已启用自动发布”是不同状态，不能混称。

## GitHub 与数据公开范围

当前仍保留 GitHub 备用源，没有执行删除、改私有或历史清理。
后续可以把源码仓库设为私有，并以独立公开仓库仅发布网页必需文件；线上数据
主存储保留阿里云。切换前必须处理旧客户端的 GitHub 回退地址及 Pages 部署。

阿里云公开 JSON、网页静态文件和 APK 内置数据都能被客户端读取，不能当作
保密措施。真正不能公开的密钥及核心服务端逻辑不应下发。删除仓库当前文件不
会清除 Git 历史、Release、CDN 或已下载副本；是否清理需单独决定。
