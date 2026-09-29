# New UI Reference

这个目录只放 UI 复原参考，不接入线上页面。

- `reference-preview.html`：当前复原稿，包含配色、字体、布局和图标使用方式。
- `wiki-demo.html`：v0.3 Wiki 化首页、列表页、详情层级和迁移计算页的交互 demo。
- `wiki-data.js`：从原版 `whiterabbit_data.json` 与攻略资料生成的数据镜像，供 demo 使用。
- `assets/combat-swords-source.png`：用户提供的原始双剑图。
- `assets/combat-swords-red.png`：透明背景、砖红线稿版双剑图，后续正式接入优先复用它。

当前正式页面仍然是 `web/index.html`，计算逻辑和 APK 资源没有因为这个目录变化。demo 的计算页只迁移展示层和常用数据口径，完整装备、技艺、阵法、随机伤害、格挡、闪避与 debuff 仍由原版 `web/app.js` 接管；后续正式迁移应复用原版计算函数，不在新页面复制第二套公式。
