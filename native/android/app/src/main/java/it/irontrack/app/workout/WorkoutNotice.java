package it.irontrack.app.workout;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONException;
import org.json.JSONObject;

import it.irontrack.app.MainActivity;
import it.irontrack.app.R;

/**
 * Notifica dell'allenamento in corso (barra delle notifiche e schermata di blocco) e avviso di fine recupero.
 *
 * - "Allenamento in corso": silenziosa e fissa, con esercizio, serie, carico e il conto alla rovescia
 *   del recupero disegnato dal sistema (non serve che l'app sia attiva).
 * - "Fine recupero": suono e vibrazione all'ora di fine, programmata con AlarmManager così arriva anche
 *   a schermo bloccato. Se l'app è in primo piano suona già lei e l'avviso non viene mostrato.
 *
 * Lo stato arriva dall'app web (FerroWorkoutPlugin.show) e resta salvato per ridisegnare la notifica a fine recupero.
 */
public final class WorkoutNotice {
    static final String CHANNEL_ONGOING = "ferro_workout";
    static final String CHANNEL_END = "ferro_rest_end";
    static final int ID_ONGOING = 4101;
    static final int ID_END = 4102;
    private static final String PREFS = "ferro_workout";
    private static final String KEY_STATE = "state";

    /** true mentre l'app è in primo piano (aggiornato dal plugin). */
    static volatile boolean appVisible = false;

    private WorkoutNotice() {}

    static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ongoing = new NotificationChannel(CHANNEL_ONGOING, "Allenamento in corso", NotificationManager.IMPORTANCE_LOW);
        ongoing.setDescription("Esercizio, serie e recupero mentre ti alleni, anche sulla schermata di blocco.");
        ongoing.setShowBadge(false);
        ongoing.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ongoing);
        NotificationChannel end = new NotificationChannel(CHANNEL_END, "Fine recupero", NotificationManager.IMPORTANCE_HIGH);
        end.setDescription("Suona e vibra quando il recupero è finito, anche a schermo bloccato.");
        end.enableVibration(true);
        end.setVibrationPattern(new long[] { 0, 300, 150, 300 });
        end.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(end);
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject state(Context c) {
        try {
            return new JSONObject(prefs(c).getString(KEY_STATE, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction("it.irontrack.app.OPEN_workout");
        i.putExtra("ferro_tab", "workout");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 4100, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent alarmIntent(Context c) {
        Intent i = new Intent(c, RestAlarmReceiver.class);
        return PendingIntent.getBroadcast(c, 4103, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    /** Salva lo stato, ridisegna la notifica fissa e programma (o toglie) l'avviso di fine recupero. */
    static void show(Context c, JSONObject s) {
        prefs(c).edit().putString(KEY_STATE, s.toString()).apply();
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        nm.cancel(ID_END);
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am != null) am.cancel(alarmIntent(c));
        long endAt = s.optLong("endAt", 0);
        if (endAt > System.currentTimeMillis() && s.optBoolean("alert", true) && am != null) {
            if (canExact(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endAt, alarmIntent(c));
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endAt, alarmIntent(c));
        }
        post(c, s, endAt > System.currentTimeMillis());
    }

    /** Notifica fissa con i dati dell'allenamento. resting: mostra il conto alla rovescia fino a endAt. */
    static void post(Context c, JSONObject s, boolean resting) {
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        channels(c);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ferro_notify)
            .setContentTitle(s.optString("title", "Allenamento"))
            .setContentText(resting ? s.optString("restText", "Recupero") : s.optString("text", ""))
            .setSubText(s.optString("sub", null))
            .setContentIntent(openApp(c))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        int total = s.optInt("total", 0);
        if (total > 0) b.setProgress(total, Math.min(total, s.optInt("done", 0)), false);
        if (resting) {
            b.setUsesChronometer(true).setChronometerCountDown(true).setWhen(s.optLong("endAt")).setShowWhen(true);
        } else {
            b.setShowWhen(false);
        }
        try {
            NotificationManagerCompat.from(c).notify(ID_ONGOING, b.build());
        } catch (SecurityException e) {
            // permesso delle notifiche revocato nel frattempo
        }
    }

    /** Avviso di fine recupero: suona e vibra (canale "Fine recupero"). */
    static void restOver(Context c) {
        JSONObject s = state(c);
        post(c, s, false);
        if (appVisible || !NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        channels(c);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL_END)
            .setSmallIcon(R.drawable.ferro_notify)
            .setContentTitle(s.optString("endTitle", "Recupero finito"))
            .setContentText(s.optString("endText", "Torna sotto."))
            .setContentIntent(openApp(c))
            .setAutoCancel(true)
            .setTimeoutAfter(120_000)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_SOUND)
            .setVibrate(new long[] { 0, 300, 150, 300 });
        try {
            NotificationManagerCompat.from(c).notify(ID_END, b.build());
        } catch (SecurityException e) {
            // permesso delle notifiche revocato nel frattempo
        }
    }

    /** Allenamento concluso o annullato: toglie tutto. */
    static void clear(Context c) {
        prefs(c).edit().remove(KEY_STATE).apply();
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am != null) am.cancel(alarmIntent(c));
        NotificationManagerCompat nm = NotificationManagerCompat.from(c);
        nm.cancel(ID_ONGOING);
        nm.cancel(ID_END);
    }
}
