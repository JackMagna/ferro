package it.irontrack.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

import it.irontrack.app.calendar.FerroCalendarPlugin;
import it.irontrack.app.widgets.FerroWidgetsPlugin;
import it.irontrack.app.widgets.WidgetData;
import it.irontrack.app.workout.FerroWorkoutPlugin;

/**
 * Attività principale di Ferro. Sostituisce quella generata da "npx cap add android"
 * (la copia scripts/patch-android.mjs):
 * - registra i plugin dei widget, della notifica dell'allenamento e del calendario (modulo «Nuovo evento»);
 * - ricorda quale sezione aprire quando l'app parte da un widget;
 * - passa al plugin di accesso Google la risposta della richiesta dei permessi
 *   (senza questo l'accesso con permessi extra, come Google Sheets, viene rifiutato).
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FerroWidgetsPlugin.class);
        registerPlugin(FerroWorkoutPlugin.class);
        registerPlugin(FerroCalendarPlugin.class);
        super.onCreate(savedInstanceState);
        WidgetData.rememberLaunch(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        WidgetData.rememberLaunch(this, intent);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) return;
        if (getBridge() == null) return;
        PluginHandle handle = getBridge().getPlugin("SocialLogin");
        if (handle == null) return;
        Plugin plugin = handle.getInstance();
        if (plugin instanceof SocialLoginPlugin) ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
