# 副本掉落同步流程

## 数据来源

- 文档：<https://docs.qq.com/sheet/DSWJSVEVGc1Z6Q21E>
- 工作表：`副本掉落`
- 工作表 ID：`w5z6in`
- 抓取接口：腾讯文档页面中的 `opendoc` 和 `related_sheet`

腾讯文档的表格数据不是稳定的 CSV。同步脚本会解码页面返回的 zlib/protobuf
数据，同时读取普通文本格和富文本分段。富文本分段很重要，囚龙谷外围的
武学和信物就存放在这一类单元格里。

## 每次同步

在仓库根目录执行。脚本默认会先自动请求腾讯文档页面和 `opendoc` 接口：

```sh
python3 tools/sync_tencent_dungeon_drops.py --fetch --apply
```

脚本会：

1. 请求公开文档页面，解析当前 `opendoc` 地址并切换到 `副本掉落` 工作表。
2. 保存页面和 JSONP 原始快照到 `/tmp`。
3. 解码 `related_sheet` 的 Base64/zlib 数据。
4. 读取普通文本和富文本单元格。
5. 生成标准化 `dungeon_drops`。
6. 写入 `web/whiterabbit_data.json`。
7. 写入 `reports/dungeon_drops_sync_latest.md`。
8. 报告新增、删除、修改和未匹配规则值。

如果腾讯接口因访问来源返回 401，可以在浏览器侧导出原始数据后继续执行：

```sh
python3 tools/sync_tencent_dungeon_drops.py \
  --related-bin /tmp/related0.bin \
  --jsonp /tmp/tencent-drops.jsonp \
  --apply
```

脚本在抓取失败时会直接退出，不会覆盖现有 JSON。

如果只想检查而不改 JSON，去掉 `--apply`。

## 抓取原始数据

当前抓取腾讯文档的最小步骤是：

1. 请求文档页面，保存页面 JSONP 到 `/tmp/tencent-drops.jsonp`。
2. 从 `initialAttributedText.text[0].block_datas[0].related_sheet` 读取
   Base64 字符串。
3. Base64 解码并 zlib 解压到 `/tmp/related0.bin`。
4. 执行上面的同步命令。

日常检查时先看页面中的 `collab_client_vars.rev`。revision 没有变化时，
不需要重新提交数据；revision 变化时生成报告，确认后再提交。

## 变更确认

提交前检查：

```sh
python3 -m json.tool web/whiterabbit_data.json >/dev/null
git diff -- web/whiterabbit_data.json reports/dungeon_drops_sync_latest.md
```

图鉴只读取 `web/whiterabbit_data.json` 的显式 `dungeon_drops`，不会再从
角色、武学、内功的获取文本反推副本掉落。这样新增副本、新 Boss、宝箱、
飘字和概率变化都会出现在同步报告里。

## 发布顺序

1. 确认报告和 JSON。
2. 确认灭谷阵容 `LINEUP_DIRECTORY` 仍然保留。
3. 提交并推送 GitHub。
4. 将 `web/whiterabbit_data.json` 和 APK 发布到阿里云镜像。
5. 服务器 `latest.json` 可增加：

```json
{
  "version": "0.3.4",
  "apk": "http://47.95.250.113/jianghu/v0.3.4/jianghu-calculator-0.3.4.apk",
  "release_notes": "本次更新内容……"
}
```

网页图鉴会按“阿里云服务器、GitHub Pages、jsDelivr、GitHub Raw”的顺序
尝试读取 JSON。APK 更新会优先读取阿里云 `latest.json`，失败后回退到
GitHub Releases。当前阿里云地址仍是 HTTP，服务器配置 HTTPS 后应把
Android 清单里的明文流量开关恢复为关闭。
