package it.irontrack.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.util.Calendar;

import it.irontrack.app.R;

/**
 * Widget «Motivazione»: una frase di un atleta al giorno (un tocco passa alla successiva)
 * e, sotto, da quanto non ti alleni e cosa ti aspetta.
 */
public class QuoteWidget extends FerroWidget {
    static final String ACTION_NEXT = "it.irontrack.app.widgets.NEXT_QUOTE";

    @Override
    public void onReceive(Context c, Intent intent) {
        if (ACTION_NEXT.equals(intent.getAction())) {
            int offset = WidgetData.prefs(c).getInt(WidgetData.KEY_QUOTE, 0) + 1;
            WidgetData.prefs(c).edit().putInt(WidgetData.KEY_QUOTE, offset).apply();
            AppWidgetManager mgr = AppWidgetManager.getInstance(c);
            onUpdate(c, mgr, mgr.getAppWidgetIds(new ComponentName(c, QuoteWidget.class)));
            return;
        }
        super.onReceive(c, intent);
    }

    @Override
    RemoteViews build(Context c, AppWidgetManager mgr, int id, JSONObject data) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.ferro_widget_quote);
        WidgetData.Palette p = new WidgetData.Palette(data);
        v.setInt(R.id.ferro_bg, "setColorFilter", p.bg);
        v.setTextColor(R.id.ferro_quote, p.fg);
        v.setTextColor(R.id.ferro_author, p.accentText);
        v.setTextColor(R.id.ferro_status, p.muted);

        // frase del giorno: cambia a mezzanotte, il tocco la fa avanzare
        long ms = Calendar.getInstance().getTimeInMillis();
        long day = (ms + java.util.TimeZone.getDefault().getOffset(ms)) / 86_400_000L;
        int offset = WidgetData.prefs(c).getInt(WidgetData.KEY_QUOTE, 0);
        int n = Quotes.LIST.length;
        int index = (int) (((day + offset) % n + n) % n);
        v.setTextViewText(R.id.ferro_quote, "«" + Quotes.LIST[index][0] + "»");
        v.setTextViewText(R.id.ferro_author, "— " + Quotes.LIST[index][1]);
        v.setTextViewText(R.id.ferro_status, status(data));

        Intent next = new Intent(c, QuoteWidget.class).setAction(ACTION_NEXT);
        v.setOnClickPendingIntent(R.id.ferro_quote_box, PendingIntent.getBroadcast(c, 31, next, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        v.setOnClickPendingIntent(R.id.ferro_status, WidgetData.openApp(c, "workout", 32));
        return v;
    }

    private static String status(JSONObject data) {
        JSONObject w = data.optJSONObject("workout");
        String next = w == null ? "" : w.optString("day", "");
        if (w != null && w.optBoolean("inProgress", false)) return "Allenamento in corso: " + next + ". Finiscilo.";
        if (data.isNull("lastWorkoutAt") || !data.has("lastWorkoutAt")) {
            return next.isEmpty() ? "Tocca qui e inizia il primo allenamento." : "Primo allenamento: " + next + ".";
        }
        int days = WidgetData.daysSince(data.optLong("lastWorkoutAt"));
        String then = next.isEmpty() ? "" : " Prossimo: " + next + ".";
        if (days <= 0) return "Allenamento di oggi: fatto." + then;
        if (days == 1) return "Ultimo allenamento ieri." + then;
        if (days == 2) return "Ultimo allenamento 2 giorni fa." + then;
        return "Fermo da " + days + " giorni. Oggi si torna" + (next.isEmpty() ? "." : ": " + next + ".");
    }
}
