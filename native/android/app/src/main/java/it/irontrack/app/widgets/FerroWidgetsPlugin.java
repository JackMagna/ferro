package it.irontrack.app.widgets;

import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Ponte tra l'app web e i widget: riceve i dati da mostrare e dice quale sezione aprire. */
@CapacitorPlugin(name = "FerroWidgets")
public class FerroWidgetsPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Dati mancanti");
            return;
        }
        WidgetData.prefs(getContext()).edit().putString(WidgetData.KEY_DATA, data).apply();
        WidgetData.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void takeLaunchTab(PluginCall call) {
        SharedPreferences p = WidgetData.prefs(getContext());
        String tab = p.getString(WidgetData.KEY_TAB, null);
        if (tab != null) p.edit().remove(WidgetData.KEY_TAB).apply();
        JSObject result = new JSObject();
        if (tab != null) result.put("tab", tab);
        call.resolve(result);
    }
}
