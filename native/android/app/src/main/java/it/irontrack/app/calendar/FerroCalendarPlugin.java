package it.irontrack.app.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.CalendarContract;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Apre il modulo «Nuovo evento» del calendario del telefono, già compilato con la lezione.
 * Usa Intent.ACTION_INSERT: Ferro non chiede permessi e non legge il calendario; l'utente conferma e salva.
 */
@CapacitorPlugin(name = "FerroCalendar")
public class FerroCalendarPlugin extends Plugin {

    /** { title, begin, end (ms), location?, rrule? } */
    @PluginMethod
    public void insert(PluginCall call) {
        String title = call.getString("title");
        Long begin = call.getLong("begin");
        Long end = call.getLong("end");
        if (title == null || begin == null || end == null) {
            call.reject("Dati della lezione mancanti");
            return;
        }
        Intent i = new Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, (long) begin)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, (long) end)
            .putExtra(CalendarContract.Events.TITLE, title)
            .putExtra(CalendarContract.Events.AVAILABILITY, CalendarContract.Events.AVAILABILITY_BUSY);
        String location = call.getString("location");
        if (location != null && !location.isEmpty()) i.putExtra(CalendarContract.Events.EVENT_LOCATION, location);
        String rrule = call.getString("rrule");
        if (rrule != null && !rrule.isEmpty()) i.putExtra(CalendarContract.Events.RRULE, rrule);
        try {
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Sul telefono non c'è un'app calendario.", "NO_CALENDAR");
        }
    }
}
