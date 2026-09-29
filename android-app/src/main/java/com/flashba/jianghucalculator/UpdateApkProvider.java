package com.flashba.jianghucalculator;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
/** Provides the downloaded APK to Android's package installer without exposing a file:// URI. */
public final class UpdateApkProvider extends ContentProvider {
    public static final String AUTHORITY = "com.flashba.jianghucalculator.update";

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        validateUri(uri);
        return "application/vnd.android.package-archive";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs,
                        String sortOrder) {
        validateUri(uri);
        File file = updateApkFile();
        MatrixCursor cursor = new MatrixCursor(new String[]{
            OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE
        });
        if (file.isFile()) cursor.addRow(new Object[]{file.getName(), file.length()});
        return cursor;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        validateUri(uri);
        return ParcelFileDescriptor.open(updateApkFile(), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("Read-only provider");
    }

    private void validateUri(Uri uri) {
        if (!AUTHORITY.equals(uri.getAuthority()) || !"apk".equals(uri.getLastPathSegment())) {
            throw new IllegalArgumentException("Unsupported update URI");
        }
    }

    private File updateApkFile() {
        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null) directory = getContext().getFilesDir();
        return new File(directory, "jianghu-calculator-update.apk");
    }
}
