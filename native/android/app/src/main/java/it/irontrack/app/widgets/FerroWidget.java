package it.irontrack.app.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Base dei widget di Ferro: ridisegna ogni widget con i dati salvati dall'app. */
abstract class FerroWidget extends AppWidgetProvider {

    abstract RemoteViews build(Context c, AppWidgetManager mgr, int id, JSONObject data);

    @Override
    public void onUpdate(Context c, AppWidgetManager mgr, int[] ids) {
        JSONObject data = WidgetData.read(c);
        for (int id : ids) mgr.updateAppWidget(id, build(c, mgr, id, data));
    }

    /** Ridimensionato dall'utente: si ridisegna con più o meno righe. */
    @Override
    public void onAppWidgetOptionsChanged(Context c, AppWidgetManager mgr, int id, Bundle options) {
        mgr.updateAppWidget(id, build(c, mgr, id, WidgetData.read(c)));
    }
}
