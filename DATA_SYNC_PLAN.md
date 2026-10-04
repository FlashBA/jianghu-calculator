# 数据自动更新记录

## 待优化：旧武器条目统一纳入数据包

当前武器图鉴存在两条来源：整理后的 `web/whiterabbit_data.json`，以及 APK
内置 `uc540_doc.json` 中由 `app.js` 动态拼接的旧武器。后者只有名称、品阶或
描述，属性资料不完整，容易形成噪声；更重要的是，数据包更新不能删除这类由
代码动态生成的条目。

后续改造目标：

- 武器图鉴只读取版本化数据包中的明确条目，不再从 `uc540_doc.json` 补拼旧武器。
- 在数据结构中支持稳定 ID、`enabled`/删除标记和重命名映射。
- 数据包可以新增、修改、隐藏和删除武器，同时保留收藏条目的迁移规则。
- 计算器仍可继续使用 `uc540_doc.json` 作为武器编辑器和强化数据的离线来源，
  但这份资料不再自动进入图鉴展示。
- 先在网页版和分包测试中验证，再随下一次 APK 更新切换；旧 APK 继续保持当前行为。

## 目标

简单数据更新不触发 APK 版本更新，也不打扰用户。

## 方案

- APK 内置 `web/whiterabbit_data.json`，作为离线兜底。
- APP 启动时联网检查远程 JSON，有更新就自动拉取并使用。
- 更新失败不弹窗、不阻塞启动。
- 数据按“远程最新数据 → 本机缓存 → APK 内置数据”降级。
- GitHub Release 只负责 APK、UI、功能和计算逻辑等版本更新。

## 后续处理

接入数据版本号或更新时间、本机缓存，以及多地址备用：

- GitHub Pages：`https://flashba.github.io/jianghu-calculator/whiterabbit_data.json`
- jsDelivr CDN：`https://cdn.jsdelivr.net/gh/FlashBA/jianghu-calculator@main/web/whiterabbit_data.json`
- GitHub Raw：`https://raw.githubusercontent.com/FlashBA/jianghu-calculator/main/web/whiterabbit_data.json`

建议请求顺序为 GitHub Pages → jsDelivr → GitHub Raw → 本机缓存 → APK 内置数据。
