package com.flashba.jianghucalculator;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Bundle;
import android.provider.Settings;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.view.Window;
import android.view.WindowInsets;
import android.view.DisplayCutout;
import android.view.WindowManager;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String PACKAGE_NAME = "com.flashba.jianghucalculator";
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String OSS_BASE_URL =
        "https://jianghu-baitu.oss-cn-beijing.aliyuncs.com/jianghu/";
    private static final String ECS_BASE_URL = "https://47.95.250.113/jianghu/";
    private static final String MIRROR_LATEST_URL =
        "https://47.95.250.113/jianghu/latest.json";
    private static final String RELEASES_API_URL =
        "https://api.github.com/repos/FlashBA/jianghu-calculator/releases/latest";
    private static final int UPDATE_ATTEMPTS = 2;
    private static final int UPDATE_CHECK_CONNECT_TIMEOUT_MS = 8000;
    private static final int UPDATE_CHECK_READ_TIMEOUT_MS = 12000;
    private static final int APK_CONNECT_TIMEOUT_MS = 8000;
    private static final int APK_READ_TIMEOUT_MS = 22000;
    private static final int APK_SOURCE_TIMEOUT_MS = 30000;
    private static final byte[] VAULT_MAGIC = new byte[]{
        'J', 'H', 'C', 'V', 'A', 'U', 'L', 'T'
    };
    private WebView webView;
    private Map<String, byte[]> assets;
    private AlertDialog downloadDialog;
    private ProgressBar downloadProgress;
    private TextView downloadStatus;
    private volatile boolean cancelDownload;
    private File pendingInstallFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        assets = loadAssets();

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !ASSET_HOST.equals(uri.getHost())) {
                    return super.shouldInterceptRequest(view, request);
                }
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/")) return null;
                String assetPath = path.substring("/assets/".length());
                byte[] content = assets.get(assetPath);
                if (content == null) return null;
                return new WebResourceResponse(mimeType(assetPath), "UTF-8", new ByteArrayInputStream(content));
            }
        });
        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        installSafeWebView();
        webView.loadUrl("https://" + ASSET_HOST + "/assets/index.html");
        checkForUpdate();
    }

    private void installSafeWebView() {
        Window window = getWindow();
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        } else {
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility()
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(attributes);
        }

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.rgb(244, 238, 230));
        container.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        container.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                left = Math.max(safe.left, keyboard.left);
                top = Math.max(safe.top, keyboard.top);
                right = Math.max(safe.right, keyboard.right);
                bottom = Math.max(safe.bottom, keyboard.bottom);
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= 28) {
                    DisplayCutout cutout = insets.getDisplayCutout();
                    if (cutout != null) {
                        left = Math.max(left, cutout.getSafeInsetLeft());
                        top = Math.max(top, cutout.getSafeInsetTop());
                        right = Math.max(right, cutout.getSafeInsetRight());
                        bottom = Math.max(bottom, cutout.getSafeInsetBottom());
                    }
                }
            }
            // Resize the WebView itself so fixed HTML navigation and dialogs stay safe.
            // Insets are absolute, not added to the previous padding on each dispatch.
            view.setPadding(left, top, right, bottom);
            if (Build.VERSION.SDK_INT >= 30) return WindowInsets.CONSUMED;
            WindowInsets consumed = insets.consumeSystemWindowInsets();
            if (Build.VERSION.SDK_INT >= 28) consumed = consumed.consumeDisplayCutout();
            return consumed;
        });
        setContentView(container);
        container.requestApplyInsets();
    }

    private void checkForUpdate() {
        new Thread(() -> {
            try {
                JSONObject release = fetchLatestUpdate();
                if (release == null) return;
                String latestVersion = normalizeVersion(release.optString(
                    release.has("tag_name") ? "tag_name" : "version"));
                String apkUrl = release.optString("apk", "").trim();
                if (apkUrl.isEmpty()) apkUrl = findApkUrl(release.optJSONArray("assets"));
                if (latestVersion.isEmpty() || apkUrl.isEmpty()) return;
                long latestVersionCode = resolveVersionCode(release, latestVersion);
                String releaseNotes = release.optString("release_notes", "").trim();
                if (releaseNotes.isEmpty()) releaseNotes = release.optString("notes", "").trim();
                if (releaseNotes.isEmpty()) releaseNotes = release.optString("body", "").trim();
                PackageInfo current = getPackageManager().getPackageInfo(getPackageName(), 0);
                String currentVersion = normalizeVersion(current.versionName);
                long currentVersionCode = packageVersionCode(current);
                if (!isNewerVersion(latestVersion, latestVersionCode, currentVersion, currentVersionCode)) {
                    return;
                }
                String finalApkUrl = apkUrl;
                String finalReleaseNotes = releaseNotes;
                long finalVersionCode = latestVersionCode;
                String finalSha256 = release.optString("sha256", "").trim();
                runOnUiThread(() -> showUpdateDialog(
                    latestVersion, finalVersionCode, finalApkUrl, finalReleaseNotes, finalSha256));
            } catch (Exception ignored) {
                // Update checks are optional; the offline calculator must still open.
            }
        }, "jianghu-update-check").start();
    }

    private static JSONObject fetchLatestUpdate() throws IOException, JSONException {
        for (String endpoint : new String[]{OSS_BASE_URL + "latest.json", MIRROR_LATEST_URL}) {
            try {
                JSONObject mirror = fetchJson(endpoint);
                if (mirror == null) continue;
                String version = normalizeVersion(mirror.optString("version"));
                String apkUrl = mirror.optString("apk", "").trim();
                if (!version.isEmpty() && !apkUrl.isEmpty()) return mirror;
            } catch (Exception ignored) {
                // Try the next published update source.
            }
        }
        return fetchLatestRelease();
    }

    private static JSONObject fetchJson(String endpoint) throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setConnectTimeout(4500);
        connection.setReadTimeout(4500);
        connection.setUseCaches(false);
        connection.setRequestProperty("User-Agent", "jianghu-calculator");
        connection.setRequestProperty("Cache-Control", "no-cache");
        connection.setRequestProperty("Pragma", "no-cache");
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            return new JSONObject(new String(readAll(connection.getInputStream()), "UTF-8"));
        } finally {
            connection.disconnect();
        }
    }

    private static JSONObject fetchLatestRelease() throws IOException, JSONException {
        IOException lastError = null;
        for (int attempt = 1; attempt <= UPDATE_ATTEMPTS; attempt++) {
            try {
                return fetchLatestReleaseOnce();
            } catch (IOException error) {
                lastError = error;
                if (attempt < UPDATE_ATTEMPTS) waitBeforeRetry(attempt);
            }
        }
        throw lastError == null ? new IOException("无法检查更新") : lastError;
    }

    private static JSONObject fetchLatestReleaseOnce() throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(RELEASES_API_URL).openConnection();
        connection.setConnectTimeout(UPDATE_CHECK_CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(UPDATE_CHECK_READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "jianghu-calculator");
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            return new JSONObject(new String(readAll(connection.getInputStream()), "UTF-8"));
        } finally {
            connection.disconnect();
        }
    }

    private static void waitBeforeRetry(int attempt) throws IOException {
        try {
            Thread.sleep(1000L * attempt);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IOException("更新请求被中断", error);
        }
    }

    private static String findApkUrl(JSONArray assets) {
        if (assets == null) return "";
        for (int i = 0; i < assets.length(); i++) {
            JSONObject asset = assets.optJSONObject(i);
            if (asset == null) continue;
            String name = asset.optString("name", "").toLowerCase(Locale.ROOT);
            String url = asset.optString("browser_download_url", "");
            if (name.endsWith(".apk") && !url.isEmpty()) return url;
        }
        return "";
    }

    private void showUpdateDialog(String version, long versionCode, String apkUrl,
                                  String releaseNotes, String sha256) {
        if (isFinishing() || (Build.VERSION.SDK_INT >= 17 && isDestroyed())) return;
        View content = getLayoutInflater().inflate(R.layout.update_dialog, null);
        ((TextView) content.findViewById(R.id.update_version)).setText("v" + version);
        ((TextView) content.findViewById(R.id.update_intro)).setText("新版本已发布，下载后安装。");
        ((TextView) content.findViewById(R.id.update_notes)).setText(
            releaseNotes.isEmpty() ? "本次版本暂无文字更新说明。" : limitReleaseNotes(releaseNotes));
        final AlertDialog dialog = new AlertDialog.Builder(this).setView(content).create();
        content.findViewById(R.id.update_later).setOnClickListener(view -> dialog.dismiss());
        content.findViewById(R.id.update_action).setOnClickListener(view -> {
            dialog.dismiss();
            downloadAndInstall(version, versionCode, apkUrl, sha256);
        });
        dialog.setCanceledOnTouchOutside(true);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private static String limitReleaseNotes(String notes) {
        if (notes.length() <= 1800) return notes;
        return notes.substring(0, 1800).trim() + "\n\n（更新说明过长，已截断）";
    }

    private void downloadAndInstall(String version, long versionCode, String apkUrl,
                                    String expectedSha256) {
        if (downloadDialog != null && downloadDialog.isShowing()) return;
        cancelDownload = false;
        View content = getLayoutInflater().inflate(R.layout.update_progress_dialog, null);
        ((TextView) content.findViewById(R.id.download_title)).setText("正在下载 v" + version);
        downloadProgress = content.findViewById(R.id.download_progress);
        downloadStatus = content.findViewById(R.id.download_status);
        downloadProgress.setIndeterminate(true);
        downloadDialog = new AlertDialog.Builder(this).setView(content).create();
        content.findViewById(R.id.download_cancel).setOnClickListener(view -> {
            cancelDownload = true;
            closeDownloadDialog();
        });
        downloadDialog.setOnCancelListener(dialog -> cancelDownload = true);
        downloadDialog.show();
        downloadDialog.setCanceledOnTouchOutside(false);
        styleDialogWindow(downloadDialog);

        new Thread(() -> {
            File temporaryFile = null;
            try {
                File apkFile = updateApkFile();
                temporaryFile = new File(apkFile.getParentFile(), apkFile.getName() + ".part");
                File parent = temporaryFile.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IOException("无法创建更新目录");
                }
                if (temporaryFile.exists() && !temporaryFile.delete()) {
                    throw new IOException("无法清理旧更新文件");
                }

                String githubApkUrl = githubApkUrlForVersion(version);
                ArrayList<String> downloadSources = new ArrayList<>();
                String apkPath = "v" + version + "/jianghu-calculator-" + version + ".apk";
                if (!apkUrl.isEmpty()) downloadSources.add(apkUrl);
                if (!downloadSources.contains(ECS_BASE_URL + apkPath)) downloadSources.add(ECS_BASE_URL + apkPath);
                if (!githubApkUrl.isEmpty() && !githubApkUrl.equals(apkUrl)) {
                    downloadSources.add(githubApkUrl);
                }
                IOException downloadError = null;
                for (int sourceIndex = 0; sourceIndex < downloadSources.size(); sourceIndex++) {
                    String sourceUrl = downloadSources.get(sourceIndex);
                    try {
                        String sourceName = sourceUrl.startsWith(ECS_BASE_URL) ? "阿里云服务器" : "备用地址";
                        updateDownloadSourceStatus((sourceIndex == 0 ? "正在从" : "切换至") + sourceName + "下载更新");
                        downloadApkOnce(sourceUrl, temporaryFile);
                        verifyDownloadedApk(
                            temporaryFile,
                            version,
                            versionCode,
                            expectedSha256);
                        downloadError = null;
                        break;
                    } catch (IOException error) {
                        downloadError = error;
                        if (cancelDownload) throw error;
                        if (sourceIndex + 1 < downloadSources.size()) {
                            if (temporaryFile.exists() && !temporaryFile.delete()) {
                                throw new IOException("无法清理失败的更新文件", error);
                            }
                        }
                    }
                }
                if (downloadError != null) throw downloadError;

                if (cancelDownload) throw new IOException("下载已取消");
                if (apkFile.exists() && !apkFile.delete()) {
                    throw new IOException("无法替换旧更新文件");
                }
                if (!temporaryFile.renameTo(apkFile)) {
                    throw new IOException("无法保存更新文件");
                }
                File completedFile = apkFile;
                runOnUiThread(() -> {
                    closeDownloadDialog();
                    installDownloadedApk(completedFile);
                });
            } catch (Exception error) {
                if (temporaryFile != null) temporaryFile.delete();
                runOnUiThread(() -> {
                    closeDownloadDialog();
                    if (!cancelDownload && !isFinishing()) {
                        showNoticeDialog("更新失败",
                            error.getMessage() == null ? "无法下载更新，请稍后重试。" : error.getMessage(),
                            null, "知道了", null);
                    }
                });
            }
        }, "jianghu-apk-download").start();
    }

    private void downloadApkOnce(String apkUrl, File target) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(apkUrl).openConnection();
        connection.setConnectTimeout(APK_CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(APK_READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("User-Agent", "jianghu-calculator");
        long deadline = System.nanoTime()
            + APK_SOURCE_TIMEOUT_MS * 1_000_000L;
        try {
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("下载失败（HTTP " + responseCode + "）");
            }
            long total = connection.getContentLengthLong();
            long downloaded = 0;
            byte[] buffer = new byte[8192];
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(target)) {
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (cancelDownload) throw new IOException("下载已取消");
                    if (System.nanoTime() > deadline) {
                        throw new IOException("下载超时");
                    }
                    output.write(buffer, 0, count);
                    downloaded += count;
                    updateDownloadProgress(downloaded, total);
                }
            }
        } finally {
            connection.disconnect();
        }
    }

    private void verifyDownloadedApk(File apkFile, String expectedVersion, long expectedVersionCode,
                                     String expectedSha256)
        throws IOException {
        verifySha256(apkFile, expectedSha256);
        PackageInfo downloaded = getPackageManager().getPackageArchiveInfo(
            apkFile.getAbsolutePath(), packageInfoFlags());
        if (downloaded == null) {
            throw new IOException("下载文件不是有效的 APK");
        }
        if (!PACKAGE_NAME.equals(downloaded.packageName)) {
            throw new IOException("下载文件包名不匹配");
        }

        PackageInfo current;
        try {
            current = getPackageManager().getPackageInfo(PACKAGE_NAME, packageInfoFlags());
        } catch (PackageManager.NameNotFoundException error) {
            throw new IOException("无法读取当前应用版本", error);
        }
        if (!sameSigningCertificates(current, downloaded)) {
            throw new IOException("下载文件签名不一致，无法覆盖安装");
        }
        long downloadedVersionCode = packageVersionCode(downloaded);
        long currentVersionCode = packageVersionCode(current);
        if (downloadedVersionCode <= currentVersionCode) {
            throw new IOException("下载文件版本过低（" + normalizeVersion(downloaded.versionName)
                + " / " + downloadedVersionCode + "）");
        }
        if (expectedVersionCode > 0 && downloadedVersionCode != expectedVersionCode) {
            throw new IOException("更新文件与公告版本不一致（公告 " + expectedVersion
                + " / " + expectedVersionCode + "，文件 "
                + normalizeVersion(downloaded.versionName) + " / " + downloadedVersionCode + "）");
        }
    }

    private static int packageInfoFlags() {
        if (Build.VERSION.SDK_INT >= 28) {
            return PackageManager.GET_META_DATA | PackageManager.GET_SIGNING_CERTIFICATES;
        }
        return PackageManager.GET_META_DATA | PackageManager.GET_SIGNATURES;
    }

    private static boolean sameSigningCertificates(PackageInfo left, PackageInfo right) {
        if (Build.VERSION.SDK_INT >= 28
            && left.signingInfo != null
            && right.signingInfo != null) {
            return sameSignatureSet(signaturesForSigningInfo(left.signingInfo),
                signaturesForSigningInfo(right.signingInfo));
        }
        return sameSignatureSet(left.signatures, right.signatures);
    }

    private static android.content.pm.Signature[] signaturesForSigningInfo(
        android.content.pm.SigningInfo signingInfo) {
        return signingInfo.hasMultipleSigners()
            ? signingInfo.getApkContentsSigners()
            : signingInfo.getSigningCertificateHistory();
    }

    private static boolean sameSignatureSet(
        android.content.pm.Signature[] left,
        android.content.pm.Signature[] right) {
        if (left == null || right == null || left.length != right.length) return false;
        for (android.content.pm.Signature leftSignature : left) {
            boolean found = false;
            for (android.content.pm.Signature rightSignature : right) {
                if (leftSignature.equals(rightSignature)) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }

    private static void verifySha256(File file, String expectedSha256) throws IOException {
        String expected = expectedSha256 == null
            ? "" : expectedSha256.replaceAll("[^0-9a-fA-F]", "").toLowerCase(Locale.ROOT);
        if (expected.isEmpty()) return;
        try (InputStream input = new java.io.FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                digest.update(buffer, 0, count);
            }
            StringBuilder actual = new StringBuilder();
            for (byte value : digest.digest()) {
                actual.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            }
            if (!expected.equals(actual.toString())) {
                throw new IOException("下载文件校验失败");
            }
        } catch (GeneralSecurityException error) {
            throw new IOException("无法校验下载文件", error);
        }
    }

    private static String githubApkUrlForVersion(String version) {
        String normalized = normalizeVersion(version);
        if (normalized.isEmpty()) return "";
        return "https://github.com/FlashBA/jianghu-calculator/releases/download/v"
            + normalized + "/jianghu-calculator-" + normalized + ".apk";
    }

    private static boolean isMirrorApkUrl(String url) {
        return url != null && (url.startsWith("http://47.95.250.113/jianghu/")
            || url.startsWith("https://47.95.250.113/jianghu/"));
    }

    private void updateDownloadSourceStatus(String message) {
        runOnUiThread(() -> {
            if (downloadStatus != null) downloadStatus.setText(message);
        });
    }

    private void updateDownloadProgress(long downloaded, long total) {
        runOnUiThread(() -> {
            if (downloadProgress == null) return;
            if (total > 0 && total <= Integer.MAX_VALUE) {
                downloadProgress.setIndeterminate(false);
                downloadProgress.setProgress((int) Math.min(100, downloaded * 100 / total));
                if (downloadStatus != null) {
                    downloadStatus.setText((downloaded * 100 / total) + "% · 正在保存更新文件");
                }
            } else if (downloadStatus != null) {
                downloadStatus.setText("正在下载更新文件");
            }
        });
    }

    private void closeDownloadDialog() {
        if (downloadDialog != null && downloadDialog.isShowing()) downloadDialog.dismiss();
        downloadDialog = null;
        downloadProgress = null;
        downloadStatus = null;
    }

    private File updateApkFile() {
        File directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) directory = getFilesDir();
        return new File(directory, "jianghu-calculator-update.apk");
    }

    private void installDownloadedApk(File apkFile) {
        if (!apkFile.isFile()) {
            showInstallError("更新文件不存在，请重新下载。" );
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            pendingInstallFile = apkFile;
            showNoticeDialog("需要允许安装更新",
                "请在系统设置中允许本应用安装未知来源应用，返回后会继续安装。",
                "稍后", "去设置", () -> {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                });
            return;
        }
        pendingInstallFile = null;
        Uri apkUri = Uri.parse("content://" + UpdateApkProvider.AUTHORITY + "/apk");
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(apkUri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (Exception error) {
            showInstallError("系统安装器无法打开更新文件，请重试。" );
        }
    }

    private void showInstallError(String message) {
        if (isFinishing()) return;
        showNoticeDialog("无法安装更新", message, null, "知道了", null);
    }

    private void showNoticeDialog(String title, String message, String secondaryLabel,
                                  String actionLabel, Runnable action) {
        if (isFinishing() || (Build.VERSION.SDK_INT >= 17 && isDestroyed())) return;
        View content = getLayoutInflater().inflate(R.layout.notice_dialog, null);
        ((TextView) content.findViewById(R.id.notice_title)).setText(title);
        ((TextView) content.findViewById(R.id.notice_message)).setText(message);
        Button secondary = content.findViewById(R.id.notice_secondary);
        Button actionButton = content.findViewById(R.id.notice_action);
        final AlertDialog dialog = new AlertDialog.Builder(this).setView(content).create();
        if (secondaryLabel == null || secondaryLabel.isEmpty()) {
            secondary.setVisibility(View.GONE);
        } else {
            secondary.setText(secondaryLabel);
            secondary.setOnClickListener(view -> dialog.dismiss());
        }
        actionButton.setText(actionLabel == null || actionLabel.isEmpty() ? "知道了" : actionLabel);
        actionButton.setOnClickListener(view -> {
            dialog.dismiss();
            if (action != null) action.run();
        });
        dialog.show();
        styleDialogWindow(dialog);
    }

    private void styleDialogWindow(AlertDialog dialog) {
        Window window = dialog.getWindow();
        if (window == null) return;
        window.setBackgroundDrawableResource(android.R.color.transparent);
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int dialogWidth = Math.min(screenWidth - 32, (int) (screenWidth * 0.92f));
        window.setLayout(dialogWidth, WindowManager.LayoutParams.WRAP_CONTENT);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pendingInstallFile != null
            && pendingInstallFile.isFile()
            && (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls())) {
            File apkFile = pendingInstallFile;
            pendingInstallFile = null;
            installDownloadedApk(apkFile);
        }
    }

    private static String normalizeVersion(String value) {
        String version = value == null ? "" : value.trim();
        while (version.startsWith("v") || version.startsWith("V")) {
            version = version.substring(1);
        }
        int suffix = version.indexOf('-');
        if (suffix >= 0) version = version.substring(0, suffix);
        return version;
    }

    private static long resolveVersionCode(JSONObject release, String version) {
        long declared = release.optLong("version_code", 0L);
        return declared > 0 ? declared : versionCodeForVersion(version);
    }

    private static long versionCodeForVersion(String version) {
        String[] parts = normalizeVersion(version).split("\\.");
        long major = parts.length > 0 ? parseVersionPart(parts[0]) : 0;
        long minor = parts.length > 1 ? parseVersionPart(parts[1]) : 0;
        long patch = parts.length > 2 ? parseVersionPart(parts[2]) : 0;
        return major * 10000L + minor * 100L + patch;
    }

    private static long packageVersionCode(PackageInfo packageInfo) {
        if (Build.VERSION.SDK_INT >= 28) return packageInfo.getLongVersionCode();
        return packageInfo.versionCode;
    }

    private static boolean isNewerVersion(String latestVersion, long latestVersionCode,
                                          String currentVersion, long currentVersionCode) {
        if (latestVersionCode > 0 && currentVersionCode > 0) {
            if (latestVersionCode != currentVersionCode) {
                return latestVersionCode > currentVersionCode;
            }
        }
        return compareVersions(latestVersion, currentVersion) > 0;
    }

    private static int compareVersions(String left, String right) {
        String[] leftParts = left.split("\\.");
        String[] rightParts = right.split("\\.");
        int length = Math.max(leftParts.length, rightParts.length);
        for (int i = 0; i < length; i++) {
            int leftValue = i < leftParts.length ? parseVersionPart(leftParts[i]) : 0;
            int rightValue = i < rightParts.length ? parseVersionPart(rightParts[i]) : 0;
            if (leftValue != rightValue) return Integer.compare(leftValue, rightValue);
        }
        return 0;
    }

    private static int parseVersionPart(String value) {
        String digits = value.replaceAll("[^0-9].*", "");
        if (digits.isEmpty()) return 0;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private Map<String, byte[]> loadAssets() {
        try (InputStream input = getAssets().open("app.vault")) {
            byte[] vault = readAll(input);
            if (vault.length <= VAULT_MAGIC.length + 12) throw new IOException("Invalid asset vault");
            for (int i = 0; i < VAULT_MAGIC.length; i++) {
                if (vault[i] != VAULT_MAGIC[i]) throw new IOException("Invalid asset vault signature");
            }

            byte[] nonce = new byte[12];
            System.arraycopy(vault, VAULT_MAGIC.length, nonce, 0, nonce.length);
            byte[] encrypted = new byte[vault.length - VAULT_MAGIC.length - nonce.length];
            System.arraycopy(vault, VAULT_MAGIC.length + nonce.length, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(AssetVaultKey.decode(), "AES"),
                new GCMParameterSpec(128, nonce));
            byte[] zipBytes = cipher.doFinal(encrypted);
            Map<String, byte[]> loaded = new HashMap<>();
            try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (!entry.isDirectory()) loaded.put(entry.getName(), readAll(zip));
                    zip.closeEntry();
                }
            }
            if (!loaded.containsKey("index.html")) throw new IOException("Asset vault is incomplete");
            return loaded;
        } catch (IOException | GeneralSecurityException error) {
            throw new IllegalStateException("Unable to open calculator assets", error);
        }
    }

    private static byte[] readAll(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) >= 0) {
            if (count > 0) output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
