package com.flashba.jianghucalculator;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.GeneralSecurityException;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public final class MainActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final byte[] VAULT_MAGIC = new byte[]{
        'J', 'H', 'C', 'V', 'A', 'U', 'L', 'T'
    };
    private WebView webView;
    private Map<String, byte[]> assets;

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
