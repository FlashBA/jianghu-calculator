# GitHub 数据保留范围

v0.5.0 的阿里云是第一数据源，GitHub Pages、jsDelivr、Raw 是备用路径。
删除 GitHub 数据会同时影响这三个备用源。删除当前文件也不会清除 Git 历史，
公开客户端需要读取的 JSON 无法通过换存储位置实现保密。

## 必须保留

- `web/content_manifest_v2.json` 和它引用的 `web/content-parts/*.json`：v0.5 分包更新备用源。
- `web/content_bundle.json`：网页首次加载与 APK 加密内置数据来源。
- `web/index.html`、`style.css`、`app.js`、`v03-ui.js`、`content-schema.js`、`content-updates.js`：正式网页。
- `web/uc540_doc.json`：计算器初始化资料；不能因已有分包就删除。
- `web/whiterabbit_data.json`：旧 APK 的图鉴备用源，也是当前构建输入。
- GitHub Releases APK 和发布元数据：阿里云 APK 下载失败后的备用路径。

## 目前保留的构建和兼容输入

`wiki_content.json`、`tencent_pitfalls.json`、`strategy_guides.json`、
`guide_search_index.json`、`strategy_ocr_data.json`、`tencent_recipe_data.json`、
`update_logs.json` 仍用于构建、校验或旧版攻略兼容。不能只删除文件而不调整
构建流程和兼容约定。私有化这些编辑源需要先迁移构建输入，公开发布完整包及分包。

## 已从当前发布分支移除（2026-10-02）

- `web/new-ui-reference/`：历史设计演示和参考数据，v0.5 运行时不引用。
- 根目录 `reference-preview.html`、`wiki-demo.html` 和两张 `combat-swords-*.png`：重复的历史演示及素材。
- `web/guide-directory-data.js`：旧版目录参考，v0.5 已通过数据包加载。
- `web/strategy-assets/`：原始攻略图片，v0.5 使用已提取文字和表格。JSON 中的历史图片路径仅为旧元数据，当前渲染器不会请求图片。
- `reports/dungeon_drops_source_snapshot.json`、`reports/dungeon_drops_sync_latest.md`：来源快照和解析报告。同步脚本可重新生成，旧快照存在时用于比较，不是客户端依赖。

以上文件已先归档到仓库外的本地备份，再从当前分支移除，并加入忽略规则。
后续报告和采集快照仅保存在本地或服务器私有目录。本次不改仓库可见性，
不重写 Git 历史；旧提交、标签和其他旧分支仍可能包含曾经公开的文件。
不要删除正在使用或近期发布清单引用的分包，以免请求中途出现 404。
