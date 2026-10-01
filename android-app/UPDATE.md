# APK 更新规则

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

不要只点击 `Run workflow` 来做正式发布：手动运行没有 tag 上下文，当前 Release action 会报 `GitHub Releases requires a tag`。如果只是重试已有标签的构建，应从该标签重新运行对应的 workflow；正式发布仍使用“创建并推送新标签”的流程。

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

APK 启动时会优先检查阿里云服务器的 `latest.json`。其中 `version`、`apk` 和
`release_notes`（或 `notes`）可用于显示版本和更新公告；服务器不可用、字段不完整
或下载失败时回退到 `FlashBA/jianghu-calculator` 的最新 GitHub Release。点击“立即更新”
后，APK 会在应用内下载并交给系统安装器。Android 首次安装外部 APK 时仍需用户确认，
不能静默安装。

当前服务器地址仍使用 HTTP，因此清单暂时开启了明文流量。服务器切换到 HTTPS 后，
应将 `AndroidManifest.xml` 的 `usesCleartextTraffic` 恢复为 `false`。

图鉴数据则会在 APK 或网页启动时优先从阿里云 `whiterabbit_data.json` 获取，失败后依次
尝试 GitHub Pages、jsDelivr 和 GitHub Raw，网络不可用时继续使用本地缓存或 APK 内置数据。
