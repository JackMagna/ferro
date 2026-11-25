package it.irontrack.app.workout;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Scatta all'ora di fine del recupero (AlarmManager), anche con l'app sospesa e lo schermo bloccato. */
public class RestAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        WorkoutNotice.restOver(context);
    }
}
