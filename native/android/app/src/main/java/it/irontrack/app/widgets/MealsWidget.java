package it.irontrack.app.widgets;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import it.irontrack.app.R;

/** Widget «Pasti»: calorie e macro di oggi rispetto all'obiettivo della dieta, con il tasto per aggiungere un pasto. */
public class MealsWidget extends FerroWidget {

    @Override
    RemoteViews build(Context c, AppWidgetManager mgr, int id, JSONObject data) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.ferro_widget_meals);
        WidgetData.Palette p = new WidgetData.Palette(data);
        v.setInt(R.id.ferro_bg, "setColorFilter", p.bg);
        v.setInt(R.id.ferro_add_bg, "setColorFilter", p.accent);
        v.setTextColor(R.id.ferro_add, p.accentInk);
        v.setTextColor(R.id.ferro_label, p.muted);
        v.setTextColor(R.id.ferro_kcal, p.fg);
        v.setTextColor(R.id.ferro_kcal_target, p.muted);
        v.setTextColor(R.id.ferro_note, p.muted);
        int[] macroLabels = { R.id.ferro_p_label, R.id.ferro_c_label, R.id.ferro_f_label };
        int[] macroValues = { R.id.ferro_p, R.id.ferro_c, R.id.ferro_f };
        for (int l : macroLabels) v.setTextColor(l, p.muted);
        for (int m : macroValues) v.setTextColor(m, p.fg);
        v.setOnClickPendingIntent(R.id.ferro_root, WidgetData.openApp(c, "nutrition", 21));
        v.setOnClickPendingIntent(R.id.ferro_add_box, WidgetData.openApp(c, "nutrition", 22));

        JSONObject meals = data.optJSONObject("meals");
        if (meals == null) {
            v.setViewVisibility(R.id.ferro_numbers, View.GONE);
            v.setViewVisibility(R.id.ferro_note, View.VISIBLE);
            v.setTextViewText(R.id.ferro_note, data.optBoolean("mealsLocked", false)
                ? "Per vedere i pasti qui, apri Ferro e dai il consenso ai dati sulla salute."
                : "Apri Ferro: il widget si riempie dopo il primo avvio.");
            return v;
        }
        v.setViewVisibility(R.id.ferro_numbers, View.VISIBLE);
        v.setViewVisibility(R.id.ferro_note, View.GONE);

        // a mezzanotte i totali ripartono da zero anche se l'app non è stata aperta
        boolean today = WidgetData.todayIso().equals(meals.optString("date"));
        double kcal = today ? meals.optDouble("kcal", 0) : 0;
        double[] eaten = today
            ? new double[] { meals.optDouble("proteinG", 0), meals.optDouble("carbsG", 0), meals.optDouble("fatG", 0) }
            : new double[] { 0, 0, 0 };
        JSONObject t = meals.optJSONObject("target");
        if (t == null) t = new JSONObject();
        double kcalTarget = t.optDouble("kcal", 0);
        double[] targets = { t.optDouble("proteinG", 0), t.optDouble("carbsG", 0), t.optDouble("fatG", 0) };

        int width = WidgetData.widthDp(mgr, id, 250);
        v.setTextViewText(R.id.ferro_kcal, WidgetData.number(kcal));
        if (kcalTarget > 0) {
            v.setTextViewText(R.id.ferro_kcal_target, " / " + WidgetData.number(kcalTarget) + " kcal");
            v.setViewVisibility(R.id.ferro_kcal_bar, View.VISIBLE);
            v.setImageViewBitmap(R.id.ferro_kcal_bar, WidgetData.bar(c, width - 32, (float) (kcal / kcalTarget), p.track, p.accent));
        } else {
            v.setTextViewText(R.id.ferro_kcal_target, " kcal");
            v.setViewVisibility(R.id.ferro_kcal_bar, View.GONE);
        }

        int[] bars = { R.id.ferro_p_bar, R.id.ferro_c_bar, R.id.ferro_f_bar };
        int macroWidth = Math.max(40, (width - 32 - 24) / 3);
        for (int i = 0; i < 3; i++) {
            String g = WidgetData.number(eaten[i]);
            if (targets[i] > 0) {
                v.setTextViewText(macroValues[i], g + " / " + WidgetData.number(targets[i]) + " g");
                v.setViewVisibility(bars[i], View.VISIBLE);
                v.setImageViewBitmap(bars[i], WidgetData.bar(c, macroWidth, (float) (eaten[i] / targets[i]), p.track, p.fg));
            } else {
                v.setTextViewText(macroValues[i], g + " g");
                v.setViewVisibility(bars[i], View.GONE);
            }
        }
        return v;
    }
}
