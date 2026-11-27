package it.irontrack.app.update;

import android.Manifest;
import android.app.DownloadManager;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import androidx.core.content.FileProvider;

import java.io.File;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Aggiornamento dell'APK scaricato dal sito: download con DownloadManager, installazione con il programma di
 * installazione di Android, controllo giornaliero (UpdateCheckJob).
 * Tutto è spento se il manifest non dichiara REQUEST_INSTALL_PACKAGES: il file per Google Play non lo ha
 * (lo toglie scripts/patch-android.mjs --play), perché lì gli aggiornamenti li fa solo il Play Store.
 */
public final class AppUpdate {
    static final String PREFS = "ferro_update";
    static final int JOB_ID = 4210;
    private static final String FILE = "ferro-aggiornamento.apk";
    private static final Pattern VERSION = Pattern.compile("^v?(\\d+)\\.(\\d+)\\.(\\d+)$");

    private AppUpdate() {}

    /** true nell'APK del sito (permesso dichiarato), false nel file per Google Play. */
    public static boolean selfUpdating(Context ctx) {
        try {
            PackageInfo p = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), PackageManager.GET_PERMISSIONS);
            return p.requestedPermissions != null && Arrays.asList(p.requestedPermissions).contains(Manifest.permission.REQUEST_INSTALL_PACKAGES);
        } catch (Exception e) {
            return false;
        }
    }

    /** L'utente ha consentito a Ferro di installare app («Installa app sconosciute», Android 8+). */
    public static boolean canInstall(Context ctx) {
        return Build.VERSION.SDK_INT < 26 || ctx.getPackageManager().canRequestPackageInstalls();
    }

    public static String installedVersion(Context ctx) {
        try {
            return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return null;
        }
    }

    /** Come isNewer in src/lib/appUpdate.ts: false se una delle due non è vX.Y.Z (le build di prova). */
    public static boolean isNewer(String latest, String current) {
        if (latest == null || current == null) return false;
        Matcher a = VERSION.matcher(latest.trim());
        Matcher b = VERSION.matcher(current.trim());
        if (!a.matches() || !b.matches()) return false;
        for (int i = 1; i <= 3; i++) {
            int x = Integer.parseInt(a.group(i));
            int y = Integer.parseInt(b.group(i));
            if (x != y) return x > y;
        }
        return false;
    }

    /**
     * Controllo una volta al giorno, solo con la rete; se è già in programma non lo riprogramma.
     * Dopo un riavvio del telefono riparte alla prossima apertura dell'app (niente permesso di avvio).
     */
    public static void schedule(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null || js.getPendingJob(JOB_ID) != null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(ctx, UpdateCheckJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(TimeUnit.DAYS.toMillis(1), TimeUnit.HOURS.toMillis(6))
            .build();
        js.schedule(job);
    }

    public static void cancel(Context ctx) {
        JobScheduler js = (JobScheduler) ctx.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB_ID);
    }

    private static File file(Context ctx) {
        return new File(ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), FILE);
    }

    /** Avvia il download dell'APK nella cartella privata dell'app; restituisce l'id di DownloadManager. */
    public static long download(Context ctx, String url, String title) {
        File f = file(ctx);
        if (f.exists()) f.delete();
        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
            .setTitle(title)
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(ctx, Environment.DIRECTORY_DOWNLOADS, FILE);
        return dm.enqueue(r);
    }

    /** Stato del download: { status: running | done | failed, done, total } (byte). */
    public static long[] progress(Context ctx, long id) {
        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(id))) {
            if (c == null || !c.moveToFirst()) return new long[] { -1, 0, 0 };
            int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
            long s = status == DownloadManager.STATUS_SUCCESSFUL ? 1 : status == DownloadManager.STATUS_FAILED ? -1 : 0;
            return new long[] { s, done, total };
        }
    }

    /** Apre il programma di installazione di Android sull'APK scaricato (l'utente conferma con «Aggiorna»). */
    public static boolean install(Context ctx) {
        File f = file(ctx);
        if (!f.exists()) return false;
        // FileProvider dichiarato da Capacitor (res/xml/file_paths.xml: external-path copre la cartella dell'app)
        Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
        Intent i = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
        return true;
    }
}
