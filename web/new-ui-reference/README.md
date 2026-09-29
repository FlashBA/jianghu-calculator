# New UI Reference

这个目录保留 v0.3 的视觉参考与可运行 Demo，便于分阶段验收。

- `full-demo.html`：v0.3 完整前端 Demo。前端使用新版首页、底部导航、可展开资料页和移动端布局；数据、计算公式和本地存储继续复用原版 `app.js`。
- `../index.html`：正式 Web 入口，与 `full-demo.html` 保持同一套前端。
- `wiki-demo.html`：UI/架构草稿，用于确认 Wiki 化的信息组织、导航和详情收缩方式，不代表最终完整功能。
- `reference-preview.html`：配色、字体、布局和战斗图标参考稿。
- `wiki-data.js`：供 UI 草稿展示使用的数据镜像。
- `assets/combat-swords-source.png`：用户提供的原始双剑图。
- `assets/combat-swords-red.png`：透明背景、砖红线稿版双剑图。

完整 Demo 需要通过本地 HTTP 服务打开，不能直接双击 HTML 文件。迁移原则是只复用原版数据与业务计算层，前端页面和交互统一走 v0.3。
