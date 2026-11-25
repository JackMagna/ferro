package it.irontrack.app.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Bundle;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Calendar;
import java.util.Locale;

import it.irontrack.app.MainActivity;

/**
 * Dati condivisi dai widget. L'app web li scrive con FerroWidgetsPlugin.update
 * (formato in src/lib/widgetData.ts); i widget li leggono qui.
 */
public final class WidgetData {
    static final String PREFS = "ferro_widgets";
    static final String KEY_DATA = "data";
    static final String KEY_TAB = "launch_tab";
    static final String KEY_QUOTE = "quote_offset";
    static final String EXTRA_TAB = "ferro_tab";

    private WidgetData() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONObject read(Context c) {
        try {
            return new JSONObject(prefs(c).getString(KEY_DATA, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    /** Se l'app è stata aperta da un widget, ricorda la sezione: l'app web la chiede con takeLaunchTab. */
    public static void rememberLaunch(Context c, Intent intent) {
        if (intent == null) return;
        String tab = intent.getStringExtra(EXTRA_TAB);
        if (tab != null) prefs(c).edit().putString(KEY_TAB, tab).apply();
    }

    /** Colori del tema scelto nell'app (con i valori del tema Classico scuro se mancano). */
    static final class Palette {
        final int bg, fg, muted, accent, accentText, accentInk, track;

        Palette(JSONObject data) {
            JSONObject p = data.optJSONObject("palette");
            if (p == null) p = new JSONObject();
            bg = color(p, "bg", 0xFF222529);
            fg = color(p, "fg", 0xFFEEEBE4);
            muted = color(p, "muted", 0xFFA8A69E);
            accent = color(p, "accent", 0xFFF0C33C);
            accentText = color(p, "accentText", 0xFFF0C33C);
            accentInk = color(p, "accentInk", 0xFF2A2104);
            track = color(p, "track", 0xFF2C3035);
        }

        private static int color(JSONObject p, String key, int fallback) {
            try {
                return Color.parseColor(p.optString(key, ""));
            } catch (IllegalArgumentException e) {
                return fallback;
            }
        }
    }

    static PendingIntent openApp(Context c, String tab, int requestCode) {
        Intent i = new Intent(c, MainActivity.class);
        i.setAction("it.irontrack.app.OPEN_" + tab);
        i.putExtra(EXTRA_TAB, tab);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, requestCode, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Chiede a tutti i widget di Ferro di ridisegnarsi. */
    static void refreshAll(Context c) {
        Class<?>[] providers = { WorkoutWidget.class, MealsWidget.class, QuoteWidget.class };
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        for (Class<?> cls : providers) {
            int[] ids = mgr.getAppWidgetIds(new ComponentName(c, cls));
            if (ids == null || ids.length == 0) continue;
            Intent i = new Intent(c, cls);
            i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            c.sendBroadcast(i);
        }
    }

    /** Barra di avanzamento disegnata come immagine, così prende i colori del tema su ogni versione di Android. */
    static Bitmap bar(Context c, int widthDp, float fraction, int track, int fill) {
        float d = c.getResources().getDisplayMetrics().density;
        int w = Math.max(8, Math.round(widthDp * d));
        int h = Math.max(4, Math.round(6 * d));
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(b);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float r = h / 2f;
        paint.setColor(track);
        canvas.drawRoundRect(new RectF(0, 0, w, h), r, r, paint);
        float f = Math.max(0f, Math.min(1f, fraction));
        if (f > 0) {
            paint.setColor(fill);
            canvas.drawRoundRect(new RectF(0, 0, Math.max(h, w * f), h), r, r, paint);
        }
        return b;
    }

    static String number(double n) {
        return NumberFormat.getIntegerInstance(Locale.ITALY).format(Math.round(n));
    }

    /** Larghezza e altezza del widget in dp (le minime sono quelle in verticale). */
    static int widthDp(AppWidgetManager mgr, int id, int fallback) {
        Bundle o = mgr.getAppWidgetOptions(id);
        int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        return w > 0 ? w : fallback;
    }

    static int heightDp(AppWidgetManager mgr, int id, int fallback) {
        Bundle o = mgr.getAppWidgetOptions(id);
        int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        return h > 0 ? h : fallback;
    }

    static String todayIso() {
        Calendar cal = Calendar.getInstance();
        return String.format(Locale.ROOT, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
    }

    /** Giorni di calendario passati da un istante (0 = oggi). */
    static int daysSince(long ms) {
        Calendar then = Calendar.getInstance();
        then.setTimeInMillis(ms);
        startOfDay(then);
        Calendar now = Calendar.getInstance();
        startOfDay(now);
        return (int) Math.round((now.getTimeInMillis() - then.getTimeInMillis()) / 86_400_000d);
    }

    private static void startOfDay(Calendar c) {
        c.set(Calendar.HOUR_OF_DAY, 12);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
    }
}
