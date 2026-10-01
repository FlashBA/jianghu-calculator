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

## 可先归档后移出公开目录的候选

- `web/new-ui-reference/`：历史设计演示和参考数据，v0.5 运行时不引用。
- `web/guide-directory-data.js`：旧版目录参考，v0.5 已通过数据包加载。
- `web/strategy-assets/`：原始攻略图片，v0.5 使用已提取文字；先检查旧网页及文档链接，再归档。
- `reports/` 内原始快照/解析报告：当前客户端不读取；同步工具如有依赖需先迁到私有目录。

本次只记录审计结果，不执行数据删除、仓库改私有或历史清理。
不要删除正在使用或近期发布清单引用的分包，以免请求中途出现 404。
