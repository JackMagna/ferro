package it.irontrack.app.workout;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Ponte tra l'app web e la notifica dell'allenamento in corso (vedi WorkoutNotice) e gli allenamenti in Health Connect (HealthWorkout). */
@CapacitorPlugin(
    name = "FerroWorkout",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") }
)
public class FerroWorkoutPlugin extends Plugin {

    @Override
    public void load() {
        WorkoutNotice.appVisible = true;
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        WorkoutNotice.appVisible = true;
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        WorkoutNotice.appVisible = false;
    }

    @PluginMethod
    public void show(PluginCall call) {
        WorkoutNotice.show(getContext(), call.getData());
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        WorkoutNotice.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    /** Chiede il permesso delle notifiche (Android 13+); sulle versioni precedenti non serve. */
    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(statusObject());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsResult");
    }

    @PermissionCallback
    private void notificationsResult(PluginCall call) {
        call.resolve(statusObject());
    }

    /** Apre l'impostazione «Sveglie e promemoria» (Android 12+), che rende puntuale l'avviso di fine recupero. */
    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31) {
            Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    /* ---------- allenamenti in Health Connect ---------- */

    /** Chiede a Health Connect il permesso di scrivere gli allenamenti. Risponde { granted }. */
    @PluginMethod
    public void requestHealthWorkout(PluginCall call) {
        if (!HealthWorkout.available(getContext())) {
            call.reject("Health Connect non è disponibile su questo telefono.");
            return;
        }
        new Thread(() -> {
            try {
                if (HealthWorkout.granted(getContext())) {
                    JSObject r = new JSObject();
                    r.put("granted", true);
                    call.resolve(r);
                    return;
                }
                getActivity().runOnUiThread(() -> startActivityForResult(call, HealthWorkout.permissionIntent(getContext()), "healthWorkoutResult"));
            } catch (Exception e) {
                call.reject("Health Connect non risponde: " + e.getMessage());
            }
        }).start();
    }

    /** Senza chiedere niente: Health Connect c'è? Ferro può salvare gli allenamenti (e la distanza)? Risponde { available, granted, distance }. */
    @PluginMethod
    public void healthWorkoutStatus(PluginCall call) {
        if (!HealthWorkout.available(getContext())) {
            JSObject r = new JSObject();
            r.put("available", false);
            r.put("granted", false);
            r.put("distance", false);
            call.resolve(r);
            return;
        }
        new Thread(() -> {
            try {
                java.util.Set<String> granted = HealthWorkout.grantedSet(getContext());
                JSObject r = new JSObject();
                r.put("available", true);
                r.put("granted", granted.contains(HealthWorkout.PERMISSION));
                r.put("distance", granted.contains(HealthWorkout.DISTANCE));
                call.resolve(r);
            } catch (Exception e) {
                call.reject("Health Connect non risponde: " + e.getMessage());
            }
        }).start();
    }

    @ActivityCallback
    private void healthWorkoutResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        java.util.Set<String> granted = HealthWorkout.contract().parseResult(result.getResultCode(), result.getData());
        JSObject r = new JSObject();
        r.put("granted", granted != null && granted.contains(HealthWorkout.PERMISSION));
        call.resolve(r);
    }

    /** Salva un allenamento: { id, start, end, title, notes, type, distance } (start/end in ms; type: vedi HealthWorkout.exerciseType). */
    @PluginMethod
    public void saveHealthWorkout(PluginCall call) {
        String id = call.getString("id");
        Long start = call.getLong("start");
        Long end = call.getLong("end");
        if (id == null || start == null || end == null) {
            call.reject("Dati dell'allenamento mancanti");
            return;
        }
        String title = call.getString("title", "Allenamento");
        String notes = call.getString("notes", null);
        int type = HealthWorkout.exerciseType(call.getString("type", "strength"));
        double distance = call.getDouble("distance", 0.0);
        new Thread(() -> {
            try {
                HealthWorkout.save(getContext(), id, start, end, title, notes, type, distance);
                call.resolve();
            } catch (SecurityException e) {
                call.reject("Health Connect: manca il permesso per gli allenamenti. Ricollega Health Connect e consentilo.", "PERMISSION");
            } catch (Exception e) {
                call.reject("Health Connect non ha salvato l'allenamento: " + e.getMessage());
            }
        }).start();
    }

    private JSObject statusObject() {
        JSObject r = new JSObject();
        r.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        r.put("exact", WorkoutNotice.canExact(getContext()));
        return r;
    }
}
