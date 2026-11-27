package it.irontrack.app.update;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Ponte tra l'app web (src/services/appUpdater.ts) e l'aggiornamento dell'APK del sito (AppUpdate). */
@CapacitorPlugin(name = "FerroUpdate")
public class FerroUpdatePlugin extends Plugin {

    /** { selfUpdating, canInstall }: selfUpdating è false nel file per Google Play. */
    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    /** Programma il controllo giornaliero con notifica (solo nell'APK del sito). */
    @PluginMethod
    public void schedule(PluginCall call) {
        if (AppUpdate.selfUpdating(getContext())) AppUpdate.schedule(getContext());
        call.resolve(statusObject());
    }

    /** Apre «Installa app sconosciute» per Ferro; al ritorno risponde con lo stato aggiornato. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < 26) {
            call.resolve(statusObject());
            return;
        }
        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        startActivityForResult(call, i, "installSettingsResult");
    }

    @ActivityCallback
    private void installSettingsResult(PluginCall call, ActivityResult result) {
        if (call != null) call.resolve(statusObject());
    }

    /** { url, title } → { id }: avvia il download dell'APK. */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (!AppUpdate.selfUpdating(getContext())) {
            call.reject("Aggiornamento non disponibile in questa versione dell'app.");
            return;
        }
        if (url == null || !url.startsWith("https://github.com/JackMagna/ferro/releases/")) {
            call.reject("Indirizzo dell'aggiornamento non valido.");
            return;
        }
        try {
            JSObject r = new JSObject();
            r.put("id", AppUpdate.download(getContext(), url, call.getString("title", "Ferro")));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Download non avviato: " + e.getMessage());
        }
    }

    /** { id } → { status: running | done | failed, done, total }. */
    @PluginMethod
    public void progress(PluginCall call) {
        Long id = call.getLong("id");
        if (id == null) {
            call.reject("id mancante");
            return;
        }
        long[] p = AppUpdate.progress(getContext(), id);
        JSObject r = new JSObject();
        r.put("status", p[0] == 1 ? "done" : p[0] == -1 ? "failed" : "running");
        r.put("done", p[1]);
        r.put("total", p[2]);
        call.resolve(r);
    }

    /** Apre il programma di installazione di Android sull'APK scaricato. */
    @PluginMethod
    public void install(PluginCall call) {
        try {
            if (AppUpdate.install(getContext())) call.resolve();
            else call.reject("File dell'aggiornamento non trovato: riprova.");
        } catch (Exception e) {
            call.reject("Installazione non avviata: " + e.getMessage());
        }
    }

    private JSObject statusObject() {
        JSObject r = new JSObject();
        r.put("selfUpdating", AppUpdate.selfUpdating(getContext()));
        r.put("canInstall", AppUpdate.canInstall(getContext()));
        return r;
    }
}
