package com.qnlbc.churchapp;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "OfflineLibrary")
public class OfflineLibraryPlugin extends Plugin {
    private static final String KEY_ALIAS = "qnlbc-offline-library-v1";
    private static final int IV_SIZE = 12;

    private AtomicFile library() {
        return new AtomicFile(new File(getContext().getNoBackupFilesDir(), "offline-library.v1"));
    }

    private SecretKey key(boolean create) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        SecretKey existing = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (existing != null || !create) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return generator.generateKey();
    }

    @PluginMethod
    public synchronized void read(PluginCall call) {
        try {
            AtomicFile file = library();
            if (!file.getBaseFile().exists()) {
                call.resolve();
                return;
            }
            byte[] bytes = file.readFully();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, bytes, 0, IV_SIZE));
            String value = new String(cipher.doFinal(bytes, IV_SIZE, bytes.length - IV_SIZE), StandardCharsets.UTF_8);
            JSObject result = new JSObject();
            result.put("value", value);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not open offline library", error);
        }
    }

    @PluginMethod
    public synchronized void write(PluginCall call) {
        String value = call.getString("value");
        if (value == null) {
            call.reject("Missing offline library");
            return;
        }
        AtomicFile file = library();
        FileOutputStream output = null;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(true));
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            output = file.startWrite();
            output.write(cipher.getIV());
            output.write(encrypted);
            file.finishWrite(output);
            call.resolve();
        } catch (Exception error) {
            if (output != null) file.failWrite(output);
            call.reject("Could not save offline library", error);
        }
    }

    @PluginMethod
    public synchronized void clear(PluginCall call) {
        library().delete();
        call.resolve();
    }
}
