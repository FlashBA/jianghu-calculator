package com.flashba.jianghucalculator;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Bundle;
import android.provider.Settings;
import android.content.pm.PackageInfo;
import android.view.Window;
import android.view.WindowManager;
import android.view.View;
import android.widget.Button;
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
import java.security.GeneralSecurityException;
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
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String RELEASES_API_URL =
        "https://api.github.com/repos/FlashBA/jianghu-calculator/releases/latest";
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
        webView.loadUrl("https://" + ASSET_HOST + "/assets/index.html");
        setContentView(webView);
        checkForUpdate();
    }

    private void checkForUpdate() {
        new Thread(() -> {
            try {
                JSONObject release = fetchLatestRelease();
                if (release == null) return;
                String latestVersion = normalizeVersion(release.optString("tag_name"));
                String apkUrl = findApkUrl(release.optJSONArray("assets"));
                if (latestVersion.isEmpty() || apkUrl.isEmpty()) return;
                String releaseNotes = release.optString("body", "").trim();
                PackageInfo current = getPackageManager().getPackageInfo(getPackageName(), 0);
                String currentVersion = normalizeVersion(current.versionName);
                if (compareVersions(latestVersion, currentVersion) <= 0) return;
                runOnUiThread(() -> showUpdateDialog(latestVersion, apkUrl, releaseNotes));
            } catch (Exception ignored) {
                // Update checks are optional; the offline calculator must still open.
            }
        }, "jianghu-update-check").start();
    }

    private static JSONObject fetchLatestRelease() throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(RELEASES_API_URL).openConnection();
        connection.setConnectTimeout(4500);
        connection.setReadTimeout(4500);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "jianghu-calculator");
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            return new JSONObject(new String(readAll(connection.getInputStream()), "UTF-8"));
        } finally {
            connection.disconnect();
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

    private void showUpdateDialog(String version, String apkUrl, String releaseNotes) {
        if (isFinishing() || (Build.VERSION.SDK_INT >= 17 && isDestroyed())) return;
        View content = getLayoutInflater().inflate(R.layout.update_dialog, null);
        ((TextView) content.findViewById(R.id.update_version)).setText("v" + version);
        ((TextView) content.findViewById(R.id.update_intro)).setText("GitHub 已发布新的 APK，下载完成后会交给系统安装器确认。");
        ((TextView) content.findViewById(R.id.update_notes)).setText(
            releaseNotes.isEmpty() ? "本次版本暂无文字更新说明。" : limitReleaseNotes(releaseNotes));
        final AlertDialog dialog = new AlertDialog.Builder(this).setView(content).create();
        content.findViewById(R.id.update_later).setOnClickListener(view -> dialog.dismiss());
        content.findViewById(R.id.update_action).setOnClickListener(view -> {
            dialog.dismiss();
            downloadAndInstall(version, apkUrl);
        });
        dialog.setCanceledOnTouchOutside(true);
        dialog.show();
        styleDialogWindow(dialog);
    }

    private static String limitReleaseNotes(String notes) {
        if (notes.length() <= 1800) return notes;
        return notes.substring(0, 1800).trim() + "\n\n（更新说明过长，已截断）";
    }

    private void downloadAndInstall(String version, String apkUrl) {
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

                HttpURLConnection connection = (HttpURLConnection) new URL(apkUrl).openConnection();
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("User-Agent", "jianghu-calculator");
                try {
                    if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                        throw new IOException("下载失败（HTTP " + connection.getResponseCode() + "）");
                    }
                    long total = connection.getContentLengthLong();
                    long downloaded = 0;
                    byte[] buffer = new byte[8192];
                    try (InputStream input = connection.getInputStream();
                         FileOutputStream output = new FileOutputStream(temporaryFile)) {
                        int count;
                        while ((count = input.read(buffer)) != -1) {
                            if (cancelDownload) throw new IOException("下载已取消");
                            output.write(buffer, 0, count);
                            downloaded += count;
                            updateDownloadProgress(downloaded, total);
                        }
                    }
                } finally {
                    connection.disconnect();
                }

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
