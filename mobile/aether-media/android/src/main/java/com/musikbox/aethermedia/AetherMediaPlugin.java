package com.musikbox.aethermedia;

import android.Manifest;
import android.content.ContentUris;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * MusikBox / Aether local music scanner.
 *
 * The previous implementation used @capacitor-community/media, which is a
 * PHOTOS/VIDEOS plugin (READ_MEDIA_IMAGES / READ_MEDIA_VIDEO). It therefore never
 * requested the audio permission and never enumerated audio — the library stayed
 * empty and no music/folder permission was ever prompted.
 *
 * This plugin is built for AUDIO: it requests READ_MEDIA_AUDIO (Android 13+) or
 * READ_EXTERNAL_STORAGE (older) at runtime via Capacitor's permission framework,
 * then queries MediaStore.Audio.Media for real title/artist/album/duration
 * metadata (including SD card), yielding content:// URIs the WebView can stream
 * through Capacitor's convertFileSrc after the read permission is granted.
 */
@CapacitorPlugin(
    name = "AetherMedia",
    permissions = {
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class AetherMediaPlugin extends Plugin {

    // The permission alias that actually applies to this device's SDK level.
    private static String audioAlias() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // 33+
            return "audio"; // READ_MEDIA_AUDIO
        }
        return "storage";   // READ_EXTERNAL_STORAGE
    }

    private boolean audioGranted() {
        return getPermissionState(audioAlias()) == PermissionState.GRANTED;
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", audioGranted());
        ret.put("alias", audioAlias());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        // If already granted, resolve immediately (no redundant system prompt).
        if (audioGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            ret.put("alias", audioAlias());
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias(audioAlias(), call, "permCallback");
    }

    // Capacitor calls this once the user answers the system permission dialog.
    @PermissionCallback
    private void permCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", audioGranted());
        ret.put("alias", audioAlias());
        call.resolve(ret);
    }

    @PluginMethod
    public void getAudio(PluginCall call) {
        if (!audioGranted()) {
            JSObject ret = new JSObject();
            ret.put("denied", true);
            call.resolve(ret);
            return;
        }

        JSArray out = new JSArray();
        Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.MIME_TYPE
        };
        // Only actual music tracks (excludes ringtones/alarms/podcasts).
        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";

        try (Cursor cursor = getContext().getContentResolver().query(
                collection, projection, selection, null, null)) {
            if (cursor != null) {
                int cId = cursor.getColumnIndex(MediaStore.Audio.Media._ID);
                int cTitle = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE);
                int cArtist = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST);
                int cAlbum = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM);
                int cDur = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION);
                int cSize = cursor.getColumnIndex(MediaStore.Audio.Media.SIZE);
                int cMime = cursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE);
                while (cursor.moveToNext()) {
                    long id = cursor.getLong(cId);
                    Uri uri = ContentUris.withAppendedId(collection, id);
                    JSObject item = new JSObject();
                    item.put("key", "loc-" + id);
                    item.put("uri", uri.toString()); // content://media/external/audio/media/<id>
                    item.put("title", cursor.getString(cTitle));
                    item.put("artist", cursor.getString(cArtist));
                    item.put("album", cursor.getString(cAlbum));
                    item.put("duration", cursor.getLong(cDur)); // ms
                    item.put("size", cursor.getLong(cSize));
                    item.put("mimeType", cursor.getString(cMime));
                    out.put(item);
                }
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("error", String.valueOf(e.getMessage()));
            ret.put("items", out);
            call.resolve(ret);
            return;
        }

        JSObject ret = new JSObject();
        ret.put("items", out);
        call.resolve(ret);
    }
}
