package it.irontrack.app.workout;

import android.content.Context;
import android.content.Intent;

import androidx.activity.result.contract.ActivityResultContract;
import androidx.health.connect.client.HealthConnectClient;
import androidx.health.connect.client.PermissionController;
import androidx.health.connect.client.permission.HealthPermission;
import androidx.health.connect.client.records.DistanceRecord;
import androidx.health.connect.client.records.ExerciseSessionRecord;
import androidx.health.connect.client.records.Record;
import androidx.health.connect.client.records.metadata.Metadata;
import androidx.health.connect.client.units.Length;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import kotlin.coroutines.Continuation;
import kotlin.coroutines.EmptyCoroutineContext;
import kotlinx.coroutines.BuildersKt;

/**
 * Allenamenti di Ferro in Health Connect, con il tipo giusto (forza, bici, corsa, nuoto, pilates…).
 * Il plugin @capgo/capacitor-health li sa solo leggere: la scrittura è qui.
 * Le funzioni di Health Connect sono "suspend" di Kotlin: da Java si chiamano con runBlocking, fuori dal thread principale.
 */
final class HealthWorkout {
    static final String PERMISSION = HealthPermission.WRITE_EXERCISE;
    /** Facoltativo: senza, l'allenamento si salva lo stesso ma senza distanza. */
    static final String DISTANCE = "android.permission.health.WRITE_DISTANCE";
    static final Set<String> PERMISSIONS = new HashSet<>(Arrays.asList(PERMISSION, DISTANCE));

    private HealthWorkout() {}

    static boolean available(Context c) {
        return HealthConnectClient.getSdkStatus(c) == HealthConnectClient.SDK_AVAILABLE;
    }

    static ActivityResultContract<Set<String>, Set<String>> contract() {
        return PermissionController.createRequestPermissionResultContract();
    }

    static Intent permissionIntent(Context c) {
        return contract().createIntent(c, PERMISSIONS);
    }

    @SuppressWarnings("unchecked")
    static Set<String> grantedSet(Context c) throws InterruptedException {
        HealthConnectClient client = HealthConnectClient.getOrCreate(c);
        Set<String> perms = (Set<String>) BuildersKt.runBlocking(
            EmptyCoroutineContext.INSTANCE,
            (scope, cont) -> client.getPermissionController().getGrantedPermissions((Continuation<? super Set<String>>) cont)
        );
        return perms == null ? Collections.emptySet() : perms;
    }

    /** Tutti e due i permessi (allenamenti e distanza): se manca la distanza si richiede, una volta in più. */
    static boolean granted(Context c) throws InterruptedException {
        return grantedSet(c).containsAll(PERMISSIONS);
    }

    /** Tipo di Health Connect dal nome scelto dall'app web (lib/workoutKind.ts). Sconosciuto = forza. */
    static int exerciseType(String kind) {
        if (kind == null) return ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING;
        switch (kind) {
            case "biking": return ExerciseSessionRecord.EXERCISE_TYPE_BIKING;
            case "biking_stationary": return ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY;
            case "running": return ExerciseSessionRecord.EXERCISE_TYPE_RUNNING;
            case "running_treadmill": return ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL;
            case "swimming_pool": return ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL;
            case "rowing_machine": return ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE;
            case "elliptical": return ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL;
            case "walking": return ExerciseSessionRecord.EXERCISE_TYPE_WALKING;
            case "pilates": return ExerciseSessionRecord.EXERCISE_TYPE_PILATES;
            case "yoga": return ExerciseSessionRecord.EXERCISE_TYPE_YOGA;
            case "stretching": return ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING;
            case "hiit": return ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING;
            case "exercise_class": return ExerciseSessionRecord.EXERCISE_TYPE_EXERCISE_CLASS;
            default: return ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING;
        }
    }

    /** Salva la sessione (e la distanza, se c'è); clientId = id della sessione in Ferro, così Health Connect non la duplica se arriva due volte. */
    @SuppressWarnings("unchecked")
    static void save(Context c, String clientId, long startMs, long endMs, String title, String notes, int exerciseType, double distanceM) throws InterruptedException {
        Instant start = Instant.ofEpochMilli(startMs);
        Instant end = Instant.ofEpochMilli(Math.max(endMs, startMs + 60_000));
        ZoneOffset startOffset = ZoneId.systemDefault().getRules().getOffset(start);
        ZoneOffset endOffset = ZoneId.systemDefault().getRules().getOffset(end);
        ExerciseSessionRecord record = new ExerciseSessionRecord(
            start, startOffset, end, endOffset,
            Metadata.manualEntry(clientId, 1L),
            exerciseType,
            title, notes
        );
        List<Record> records = new ArrayList<>();
        records.add(record);
        // distanza della seduta (corsa, bici, nuoto…), solo se l'utente ha dato il permesso
        if (distanceM > 0 && grantedSet(c).contains(DISTANCE)) {
            records.add(new DistanceRecord(start, startOffset, end, endOffset, Length.meters(distanceM), Metadata.manualEntry(clientId + "-distanza", 1L)));
        }
        HealthConnectClient client = HealthConnectClient.getOrCreate(c);
        BuildersKt.runBlocking(EmptyCoroutineContext.INSTANCE, (scope, cont) -> client.insertRecords(records, (Continuation) cont));
    }
}
