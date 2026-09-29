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

推送 `v主版本.次版本.修订版本` 标签后，`.github/workflows/android-release.yml` 会构建并发布 APK。仓库需要配置以下 Actions Secrets：

- `APK_KEYSTORE_BASE64`：与已安装 APK 相同的签名密钥转为 Base64
- `APK_STORE_PASSWORD`：密钥库密码
- `APK_KEY_ALIAS`：密钥别名
- `APK_KEY_PASSWORD`：密钥密码

APK 启动时会检查 `FlashBA/jianghu-calculator` 的最新 GitHub Release。发现更高版本且 Release 包含 APK 时，会显示更新公告；点击“立即更新”后，APK 会在应用内下载并交给系统安装器。Android 首次安装外部 APK 时仍需用户确认，不能静默安装。图鉴数据则会在 APK 启动时优先从 GitHub 最新 JSON 获取，网络不可用时继续使用内置数据。
