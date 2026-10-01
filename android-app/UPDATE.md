# APK 更新规则

## 当前正式版 v0.5.0（2026-10-02）

- 标签提交：`8fa7f50430584eaa4e17a2a17f57959f6be7dba0`；成功构建：Actions `36906415019`。
- versionName `0.5.0`，versionCode `500`；正式 v0.4.0 为 `400`，同签名覆盖安装已在 Android 15 / WebView 124 验证通过。
- APK SHA-256：`801363c9e21fd59f0a40c65977f1a1669f7444691f72f866b6d37845199948db`；阿里云与 GitHub Release 文件一致。
- 名称“白兔江湖宝典”，图标沿用，网页资源加密。最低安装 API 23（Android 6.0）；不保证旧 WebView 能运行，WebView 74 已知不兼容。
- 正式阿里云地址：`https://47.95.250.113/jianghu/v0.5.0/jianghu-calculator-0.5.0.apk`；GitHub Release 作为备用。
- GitHub Release 已发布，阿里云 HTTP/HTTPS `latest.json` 都已切换至本版及三条指定公告，正式网页也已同步。
- App 每次启动检查数据和 APK 更新，无 24 小时限制；只有服务器腾讯文档采集每天执行（北京时间 04:00 避坑、04:10 四类图鉴）。
- 本地分包测试、重新打开检查更新测试通过；Android 覆盖安装、加密资源离线加载及脚本错误检测通过。
- 之前的 0.5.0 测试包也是 code 500，不会自动提示同版本升级，需手动覆盖安装正式包。若用户持有其他签名或 code 大于 500 的非正式包，不能保证覆盖安装。
- GitHub 数据保留与归档候选见 `docs/PUBLIC_DATA_RETENTION.md`；本次未删除公开数据或改动仓库可见性。

覆盖安装必须同时满足：

- `AndroidManifest.xml` 中的包名保持 `com.flashba.jianghucalculator`。
- `VERSION_CODE` 必须比上一版大。
- 必须使用同一个签名密钥。当前本地版本使用 `build/jianghu-debug.keystore`，不要删除或替换它。

构建新版本时递增版本号，例如：

```sh
VERSION_CODE=200 VERSION_NAME=0.2.0 \
APK_KEYSTORE=/path/to/jianghu-debug.keystore \
APK_STORE_PASSWORD=android \
APK_KEY_ALIAS=androiddebugkey \
APK_KEY_PASSWORD=android \
JAVA_HOME=/path/to/jdk-17 ./build-apk.sh
```

脚本会生成带版本号的 APK 文件。`VERSION_CODE` 必须高于已安装版本；密钥文件、密码和 `build/` 目录不要提交到仓库。

## GitHub 自动发布与更新

### 已验证的发布流程

本项目的稳定发布方式是：先把代码提交并推送到 `main`，再在目标提交上创建并推送一个新的版本标签。标签推送会触发 `.github/workflows/android-release.yml`，它会使用同一套签名密钥构建 APK，并自动创建 GitHub Release。

```sh
# 在 analysis/ 目录执行
git status
git log -1 --oneline
git tag v0.2.0 HEAD
git push origin v0.2.0
```

版本号必须递增，并且每个版本使用未占用的新标签，例如 `v0.2.0`。推送成功后，在 GitHub Actions 中等待构建完成，再到对应 Release 检查 APK 资产。

手动 `Run workflow` 只构建并上传签名测试包和 Android 测试证据，不创建 Release。正式发布仍使用新标签，且必须通过签名、加密资源和模拟器覆盖安装检查后才创建 Release。如果只是重试已有标签的构建，应重新运行该标签对应的 workflow。

仓库需要配置以下 Actions Secrets（已经配置过的不要删除或重新生成）：

- `APK_KEYSTORE_BASE64`：与已安装 APK 相同的签名密钥转为 Base64
- `APK_STORE_PASSWORD`：密钥库密码
- `APK_KEY_ALIAS`：密钥别名
- `APK_KEY_PASSWORD`：密钥密码

本地发布前检查：

```sh
test -r android-app/build/jianghu-debug.keystore
test -r android-app/build/jianghu-debug.keystore.backup
git status --short
```

`jianghu-debug.keystore` 和 `.backup` 必须保留，且不能提交到仓库。更换签名密钥会导致用户无法覆盖安装更新。当前 `v0.1.13` 已在本地构建并完成签名校验，APK 的本地备份位于 `android-app/artifacts/jianghu-calculator-0.1.13.apk`。构建脚本会先生成资源和 `R.java`，再编译 Java，并显式使用 UTF-8 编码。

APK 启动时会优先检查阿里云服务器的 `latest.json`。其中 `version`、`version_code`、
`apk` 和 `release_notes`（或 `notes`）可用于显示版本和更新公告；缺少
`version_code` 时会按版本号推导。应用会同时比较 Android `versionCode`，下载完成后
还会校验 APK 包名、真实 `versionCode`、公告版本、SHA-256 和当前应用签名，低版本、
错链文件或不同签名的 APK 不会交给系统安装器。点击“立即更新”后，先从
`latest.json` 中的阿里云地址下载；阿里云连接失败、超时或校验失败后切换 GitHub
Release 下载，每个来源最多约 30 秒，避免更新等待过长。服务器不可用或字段不完整时，
更新检查回退到 `FlashBA/jianghu-calculator` 的最新 GitHub Release。Android 首次
安装外部 APK 时仍需用户确认，不能静默安装。

当前正式发布 APK 的 SHA-256 签名证书指纹为：

`82:BB:BD:AF:E8:0E:C0:9B:92:F0:7D:B1:27:8D:37:03:6D:4E:55:E4:C1:9E:29:48:B3:FA:5A:D5:FD:B5:2D:39`

`v0.3.1` 至 `v0.3.5` 的公开 APK 已核对为同一指纹。若用户安装的是其他
测试包、手工构建包或使用另一把 debug/release 密钥签名的包，即使包名相同，也不能
覆盖安装；另外，已安装包的 `versionCode` 高于更新包时也不能覆盖。

当前服务器地址仍使用 HTTP，因此清单暂时开启了明文流量。服务器切换到 HTTPS 后，
应将 `AndroidManifest.xml` 的 `usesCleartextTraffic` 恢复为 `false`。

图鉴数据则会在 APK 或网页启动时优先从阿里云 `whiterabbit_data.json` 获取，失败后依次
尝试 GitHub Pages、jsDelivr 和 GitHub Raw，网络不可用时继续使用本地缓存或 APK 内置数据。

## v0.5.0 测试包记录（2026-10-02）

### 分包版（当前测试包）

- 源码 `901b15b279bc5b15d00c3c2a53f49dd0ec3c1801`，Actions `36904596879` 全部通过；版本仍为 0.5.0 / 500。
- 下载：`https://47.95.250.113/jianghu/v0.5.0-test/jianghu-calculator-0.5.0-split.apk`。
- SHA-256：`db7af8dc583a06a570b45aee7e0e70cebad46112bc79f7bbd61c6e6cb266dfa3`。
- 签名、名称、加密资源验证通过；Android 15 / WebView 124 从 v0.4.0 覆盖安装及断网加载数据通过。
- 分包集成测试与 12 项 Python 测试通过，覆盖只下载变更包、缺失/损坏包不提交、备用源复用、服务器中断恢复及原有功能。
- 真实阿里云 HTTPS 测试模拟仅日志落后，实际只下载清单和日志包，并完成校验及缓存提交。没有修改线上业务数据做测试。
- 阿里云定时发布器已同步分包逻辑，手动运行两个来源同步任务成功；GitHub main/Pages 已发布分包备用数据。
- 当前清单实际 gzip 584 字节；图鉴 16,978、副本 6,695、避坑 3,039、检索 189,616、菜谱 469、攻略文本 5,935、日志 19,016、其他攻略 10,566 字节。只下载其中有变化的部分，另计 HTTP/TLS 开销。
- 下文完整包带宽测试属于上一测试构建；正式 `latest.json` 仍为 v0.4.0，未触发自动安装公告。

### 原完整包测试（历史记录）

- 源码提交：`9ad55111017c5c3e1d604cb36191409f98bc2f81`；Actions：`36902822393`，全部检查通过。
- 版本：`0.5.0` / `versionCode=500`；名称“白兔江湖宝典”；包名、签名证书及图标沿用正式版；网页资源加密为 `assets/app.vault`。
- APK SHA-256：`5f82b034f355c68ff08b6f5fe1a2bbdf4c22c993e0b6aebc27566ad4013293b4`。
- 下载：`https://47.95.250.113/jianghu/v0.5.0-test/jianghu-calculator-0.5.0.apk`；上传后重新下载校验一致。
- Android 15 / WebView 124 模拟器：从正式 v0.4.0 覆盖安装成功；断网启动后解密并加载 31 位角色，无检测到的未捕获脚本异常。断网时更新失败提示属于预期行为。
- 旧 WebView 74 无法解析页面使用的现代 JavaScript（v0.4.0 也存在）；不代表所有旧 Android 设备均通过兼容性测试。
- 离线差异合并 6 项、发布保护 5 项测试通过；数据更新集成测试通过，包含缓存回退、动态新增攻略、技艺文案/计算属性联动、收藏保留、未知等级筛选及无效数据回滚。
- 四类图鉴定时同步已接入服务器；副本仍手动维护，装备不参与云端绑定。本次未创建正式 v0.5.0 标签或修改正式 `latest.json`。

### 数据更新流量

v0.5.0 优先使用阿里云 HTTPS 内容清单与数据包，清单超时 15 秒，数据包超时 40 秒；这是每个来源的限制，并非全部重试的总上限。

- 无更新：清单正文 167 字节，另有 HTTP/TLS 开销。
- 有更新：下载完整包，不是差量更新；当前原始大小 1,254,128 字节，HTTPS gzip 后 250,512 字节（约 251 KB）。
- 20 个并发下载全部成功并通过解压后校验；最长约 11.65 秒，P95 约 11.31 秒，测试后服务器负载低。
- 100 人更新约 25 MB，1,000 人约 251 MB，未计协议开销。更大同时访问量仍可能受服务器出口带宽限制；本次没有验证百人或千人并发。
- Nginx 提供静态文件；腾讯文档由服务器定时拉取，不会随客户端人数增加而逐人抓取。
