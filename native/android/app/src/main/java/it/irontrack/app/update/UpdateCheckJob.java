package it.irontrack.app.update;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobParameters;
import android.app.job.JobService;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import it.irontrack.app.R;

/**
 * Una volta al giorno chiede a GitHub l'ultima versione (la stessa Release che legge src/lib/appUpdate.ts) e,
 * se è più nuova di quella installata, manda una notifica. Ogni versione si annuncia una volta sola.
 * Aprendo l'app dalla notifica compare il banner con «Aggiorna».
 * È un JobService di Android (programmato da AppUpdate.schedule): niente WorkManager né altre librerie.
 */
public class UpdateCheckJob extends JobService {
    private static final String LATEST = "https://api.github.com/repos/JackMagna/ferro/releases/latest";
    private static final String CHANNEL = "ferro_update";
    private static final int NOTIFICATION_ID = 4210;

    @Override
    public boolean onStartJob(JobParameters params) {
        Context ctx = getApplicationContext();
        new Thread(() -> jobFinished(params, !check(ctx))).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    /** false se va ripetuto più tardi (rete o GitHub non rispondono). */
    static boolean check(Context ctx) {
        if (!AppUpdate.selfUpdating(ctx)) {
            AppUpdate.cancel(ctx);
            return true;
        }
        try {
            String tag = latestTag();
            String current = AppUpdate.installedVersion(ctx);
            SharedPreferences prefs = ctx.getSharedPreferences(AppUpdate.PREFS, Context.MODE_PRIVATE);
            if (!AppUpdate.isNewer(tag, current) || tag.equals(prefs.getString("notified", null))) return true;
            if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return true;
            postNotice(ctx, tag);
            prefs.edit().putString("notified", tag).apply();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String latestTag() throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(LATEST).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setRequestProperty("Accept", "application/vnd.github+json");
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return new JSONObject(out.toString("UTF-8")).optString("tag_name", null);
            }
        } finally {
            c.disconnect();
        }
    }

    private static void postNotice(Context ctx, String tag) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, ctx.getString(R.string.ferro_update_channel), NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open == null) return;
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, NOTIFICATION_ID, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ferro_notify)
            .setContentTitle(ctx.getString(R.string.ferro_update_title, tag.replaceFirst("^v", "")))
            .setContentText(ctx.getString(R.string.ferro_update_text))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        nm.notify(NOTIFICATION_ID, b.build());
    }
}
