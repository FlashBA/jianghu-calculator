package com.flashba.jianghucalculator;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Builds the encrypted offline asset bundle used by the APK. */
public final class AssetVaultBuilder {
    private static final byte[] MAGIC = "JHCVAULT".getBytes(StandardCharsets.US_ASCII);

    private AssetVaultBuilder() {
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            throw new IllegalArgumentException("Usage: AssetVaultBuilder vault output-java name=path...");
        }
        File vaultFile = new File(args[0]);
        File sourceFile = new File(args[1]);
        List<AssetFile> assets = new ArrayList<>();
        for (int i = 2; i < args.length; i++) {
            int separator = args[i].indexOf('=');
            if (separator <= 0 || separator == args[i].length() - 1) {
                throw new IllegalArgumentException("Invalid asset mapping: " + args[i]);
            }
            assets.add(new AssetFile(args[i].substring(0, separator), new File(args[i].substring(separator + 1))));
        }

        byte[] key = createKey();
        byte[] nonce = new byte[12];
        new SecureRandom().nextBytes(nonce);
        byte[] zipBytes = createZip(assets);
        byte[] encrypted = encrypt(zipBytes, key, nonce);

        File parent = vaultFile.getParentFile();
        if (parent != null) parent.mkdirs();
        try (DataOutputStream output = new DataOutputStream(new FileOutputStream(vaultFile))) {
            output.write(MAGIC);
            output.write(nonce);
            output.write(encrypted);
        }
        writeKeySource(sourceFile, key);
    }

    private static byte[] createKey() throws Exception {
        KeyGenerator generator = KeyGenerator.getInstance("AES");
        generator.init(256);
        SecretKey key = generator.generateKey();
        return key.getEncoded();
    }

    private static byte[] createZip(List<AssetFile> assets) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            byte[] buffer = new byte[8192];
            for (AssetFile asset : assets) {
                if (!asset.file.isFile()) throw new IOException("Missing asset: " + asset.file);
                ZipEntry entry = new ZipEntry(asset.name);
                zip.putNextEntry(entry);
                try (FileInputStream input = new FileInputStream(asset.file)) {
                    int count;
                    while ((count = input.read(buffer)) >= 0) {
                        if (count > 0) zip.write(buffer, 0, count);
                    }
                }
                zip.closeEntry();
            }
        }
        return bytes.toByteArray();
    }

    private static byte[] encrypt(byte[] input, byte[] key, byte[] nonce) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        return cipher.doFinal(input);
    }

    private static void writeKeySource(File sourceFile, byte[] key) throws IOException {
        File parent = sourceFile.getParentFile();
        if (parent != null) parent.mkdirs();

        SecureRandom random = new SecureRandom();
        byte[] first = new byte[key.length];
        byte[] second = new byte[key.length];
        byte[] third = new byte[key.length];
        byte[] fourth = new byte[key.length];
        random.nextBytes(first);
        random.nextBytes(second);
        random.nextBytes(third);
        for (int i = 0; i < key.length; i++) {
            int mix = (first[(i * 13 + 7) & 31] & 255)
                + (second[(i * 9 + 1) & 31] & 255)
                - (third[(i * 3 + 5) & 31] & 255);
            fourth[(i * 7 + 11) & 31] = (byte) ((key[i] & 255) ^ (mix & 255));
        }

        StringBuilder source = new StringBuilder();
        source.append("package com.flashba.jianghucalculator;\n\n");
        source.append("final class AssetVaultKey {\n");
        source.append("    private AssetVaultKey() {}\n");
        source.append("    static byte[] decode() {\n");
        source.append("        byte[] first = ").append(byteArray(first)).append(";\n");
        source.append("        byte[] second = ").append(byteArray(second)).append(";\n");
        source.append("        byte[] third = ").append(byteArray(third)).append(";\n");
        source.append("        byte[] fourth = ").append(byteArray(fourth)).append(";\n");
        source.append("        byte[] key = new byte[32];\n");
        source.append("        for (int i = 0; i < key.length; i++) {\n");
        source.append("            int mix = (first[(i * 13 + 7) & 31] & 255)\n");
        source.append("                + (second[(i * 9 + 1) & 31] & 255)\n");
        source.append("                - (third[(i * 3 + 5) & 31] & 255);\n");
        source.append("            key[i] = (byte) ((fourth[(i * 7 + 11) & 31] & 255) ^ (mix & 255));\n");
        source.append("        }\n");
        source.append("        return key;\n");
        source.append("    }\n");
        source.append("}\n");

        try (FileOutputStream output = new FileOutputStream(sourceFile)) {
            output.write(source.toString().getBytes(StandardCharsets.US_ASCII));
        }
    }

    private static String byteArray(byte[] bytes) {
        StringBuilder result = new StringBuilder("new byte[]{");
        for (int i = 0; i < bytes.length; i++) {
            if (i > 0) result.append(',');
            result.append("(byte)0x");
            result.append(String.format("%02x", bytes[i] & 255));
        }
        return result.append('}').toString();
    }

    private static final class AssetFile {
        final String name;
        final File file;

        AssetFile(String name, File file) {
            this.name = name;
            this.file = file;
        }
    }
}
