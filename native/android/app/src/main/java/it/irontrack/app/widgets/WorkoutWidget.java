package it.irontrack.app.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import it.irontrack.app.R;

/** Widget «Scheda»: il prossimo allenamento (o quello in corso) con i primi esercizi. */
public class WorkoutWidget extends FerroWidget {
    private static final int[] ROWS = { R.id.ferro_row1, R.id.ferro_row2, R.id.ferro_row3, R.id.ferro_row4, R.id.ferro_row5, R.id.ferro_row6 };
    private static final int[] NAMES = { R.id.ferro_name1, R.id.ferro_name2, R.id.ferro_name3, R.id.ferro_name4, R.id.ferro_name5, R.id.ferro_name6 };
    private static final int[] SETS = { R.id.ferro_sets1, R.id.ferro_sets2, R.id.ferro_sets3, R.id.ferro_sets4, R.id.ferro_sets5, R.id.ferro_sets6 };

    @Override
    RemoteViews build(Context c, AppWidgetManager mgr, int id, JSONObject data) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.ferro_widget_workout);
        WidgetData.Palette p = new WidgetData.Palette(data);
        v.setInt(R.id.ferro_bg, "setColorFilter", p.bg);
        v.setTextColor(R.id.ferro_label, p.muted);
        v.setTextColor(R.id.ferro_title, p.fg);
        v.setTextColor(R.id.ferro_sub, p.muted);
        v.setTextColor(R.id.ferro_more, p.muted);
        v.setOnClickPendingIntent(R.id.ferro_root, WidgetData.openApp(c, "workout", 11));

        JSONObject w = data.optJSONObject("workout");
        if (w == null) {
            v.setTextViewText(R.id.ferro_label, "SCHEDA");
            v.setTextViewText(R.id.ferro_title, "Apri Ferro");
            v.setTextViewText(R.id.ferro_sub, "Il widget si riempie dopo il primo avvio.");
            for (int row : ROWS) v.setViewVisibility(row, View.GONE);
            v.setViewVisibility(R.id.ferro_more, View.GONE);
            return v;
        }

        boolean inProgress = w.optBoolean("inProgress", false);
        v.setTextViewText(R.id.ferro_label, inProgress ? "ALLENAMENTO IN CORSO" : "PROSSIMO ALLENAMENTO");
        v.setTextColor(R.id.ferro_label, inProgress ? p.accentText : p.muted);
        v.setTextViewText(R.id.ferro_title, w.optString("day", "Allenamento"));
        v.setTextViewText(R.id.ferro_sub, "Settimana " + w.optInt("week", 1) + " di " + w.optInt("totalWeeks", 1));

        // righe che stanno nell'altezza del widget (titolo e margini occupano circa 80 dp)
        int height = WidgetData.heightDp(mgr, id, 180);
        int fit = Math.max(0, Math.min(ROWS.length, (height - 84) / 22));
        JSONArray list = w.optJSONArray("exercises");
        int count = list == null ? 0 : list.length();
        int shown = Math.min(fit, count);
        for (int i = 0; i < ROWS.length; i++) {
            if (i >= shown) {
                v.setViewVisibility(ROWS[i], View.GONE);
                continue;
            }
            JSONObject e = list.optJSONObject(i);
            v.setViewVisibility(ROWS[i], View.VISIBLE);
            v.setTextViewText(NAMES[i], e == null ? "" : e.optString("name"));
            v.setTextViewText(SETS[i], e == null ? "" : e.optString("sets"));
            v.setTextColor(NAMES[i], p.fg);
            v.setTextColor(SETS[i], p.accentText);
        }
        int rest = count - shown;
        if (rest > 0 && fit > 0) {
            v.setViewVisibility(R.id.ferro_more, View.VISIBLE);
            v.setTextViewText(R.id.ferro_more, "+ " + rest + (rest == 1 ? " esercizio" : " esercizi"));
        } else if (fit == 0 && count > 0) {
            v.setViewVisibility(R.id.ferro_more, View.VISIBLE);
            v.setTextViewText(R.id.ferro_more, count + (count == 1 ? " esercizio" : " esercizi"));
        } else {
            v.setViewVisibility(R.id.ferro_more, View.GONE);
        }
        return v;
    }
}
