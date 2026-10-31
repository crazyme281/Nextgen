package com.nextgen.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Handles a tap on the "Decline" action of the incoming-call notification
 * built by CallMessagingService. Deliberately does NOT open the app — the
 * whole point of a decline button is to dismiss the call without
 * launching an Activity. Instead it calls the decline-call edge function
 * directly over plain HTTPS from native code.
 *
 * No Supabase session/JWT is available here — the app's WebView may not
 * even be running — so this hits decline-call, which authenticates via
 * the call's own unguessable id rather than a user JWT. See that
 * function's own comments for why that's an intentional, scoped
 * exception.
 */
public class CallActionReceiver extends BroadcastReceiver {

    static final String ACTION_DECLINE_CALL = "com.nextgen.app.ACTION_DECLINE_CALL";

    // Same Supabase project this app talks to (see the app's .env
    // VITE_SUPABASE_URL). Native code can't read the WebView's JS
    // environment variables, so this is kept as a plain constant here —
    // update it if the project URL ever changes.
    private static final String SUPABASE_URL = "https://mwfzxcekkyyqtrlkwtmo.supabase.co";

    @Override
    public void onReceive(Context context, Intent intent) {
        String callId = intent.getStringExtra(CallMessagingService.EXTRA_CALL_ID);

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && callId != null) {
            nm.cancel(callId.hashCode());
        }
        if (callId == null) return;

        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                URL url = new URL(SUPABASE_URL + "/functions/v1/decline-call");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                String body = "{\"callId\":\"" + callId + "\"}";
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                }
                conn.getResponseCode(); // trigger the request and drain it
                conn.disconnect();
            } catch (Exception e) {
                Log.w("CallActionReceiver", "decline-call request failed", e);
            } finally {
                pending.finish();
            }
        }).start();
    }
}
