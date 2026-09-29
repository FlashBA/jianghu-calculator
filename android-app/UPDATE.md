# APK 更新规则

覆盖安装必须同时满足：

- `AndroidManifest.xml` 中的包名保持 `com.flashba.jianghucalculator`。
- `VERSION_CODE` 必须比上一版大。
- 必须使用同一个签名密钥。当前本地版本使用 `build/jianghu-debug.keystore`，不要删除或替换它。

构建新版本时递增版本号，例如：

```sh
VERSION_CODE=109 VERSION_NAME=0.1.9 \
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
git tag v0.1.10 HEAD
git push origin v0.1.10
```

版本号必须递增，并且每个版本使用未占用的新标签，例如 `v0.1.10`。推送成功后，在 GitHub Actions 中等待构建完成，再到对应 Release 检查 APK 资产。

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

`jianghu-debug.keystore` 和 `.backup` 必须保留，且不能提交到仓库。更换签名密钥会导致用户无法覆盖安装更新。当前 `v0.1.10` 已验证发布成功，APK 的本地备份位于 `android-app/artifacts/jianghu-calculator-0.1.10.apk`。

APK 启动时会检查 `FlashBA/jianghu-calculator` 的最新 GitHub Release。发现更高版本且 Release 包含 APK 时，会显示更新公告；点击“立即更新”后，APK 会在应用内下载并交给系统安装器。Android 首次安装外部 APK 时仍需用户确认，不能静默安装。图鉴数据则会在 APK 启动时优先从 GitHub 最新 JSON 获取，网络不可用时继续使用内置数据。
