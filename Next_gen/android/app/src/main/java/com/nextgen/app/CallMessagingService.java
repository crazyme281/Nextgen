package com.nextgen.app;

import android.app.ActivityManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.List;
import java.util.Map;

/**
 * Extends Capacitor's own FCM MessagingService so every existing push
 * behavior (device-token registration, the JS "pushNotificationReceived"
 * event for every OTHER kind of notification) keeps working exactly as
 * before via super.onMessageReceived(). The ONLY thing this class does
 * differently is intercept `data.type == "incoming_call"` pushes and
 * build a real, high-priority notification with Answer/Decline actions,
 * instead of letting the default plugin machinery draw a plain
 * tap-to-open banner with no actions on it.
 *
 * Registered in AndroidManifest.xml IN PLACE OF (not alongside) the
 * plugin's own declared service — see the tools:node="remove" comment
 * next to it there for why, and how to re-verify the class name after a
 * future @capacitor/push-notifications upgrade.
 */
public class CallMessagingService extends MessagingService {

    static final String CALL_CHANNEL_ID = "calls";
    static final String EXTRA_CALL_ID = "callId";
    static final String EXTRA_CONVERSATION_ID = "conversationId";
    static final String EXTRA_CALLER_ID = "callerId";
    static final String EXTRA_CALLER_NAME = "callerName";
    static final String EXTRA_CALLER_AVATAR = "callerAvatar";
    static final String EXTRA_CALL_TYPE = "callType";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (data != null && "incoming_call".equals(data.get("type"))) {
            // send-call-push fires this unconditionally alongside the
            // realtime broadcast, for every call, regardless of whether
            // the receiver is actually active in the app right now (see
            // CallScreen.tsx — deliberately not gated on a server-side
            // presence check, which has its own race conditions). When
            // the app IS in the foreground, CallContext's in-app banner
            // already has this covered, so skip building a second,
            // redundant system notification (own ringtone, own Answer/
            // Decline) on top of it.
            if (!isAppInForeground(getApplicationContext())) {
                showIncomingCallNotification(data);
            }
            return; // handled entirely ourselves either way — don't let
                    // the default plugin machinery ALSO draw its own
                    // plain banner for the same push.
        }
        super.onMessageReceived(remoteMessage);
    }

    private boolean isAppInForeground(Context context) {
        ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (activityManager == null) return false;
        List<ActivityManager.RunningAppProcessInfo> processes = activityManager.getRunningAppProcesses();
        if (processes == null) return false;
        String packageName = context.getPackageName();
        for (ActivityManager.RunningAppProcessInfo process : processes) {
            // Regular apps only get their OWN process(es) back from this
            // API (a privacy restriction since Android 5.0), so no extra
            // permission is needed here — this can't see other apps.
            if (process.processName.equals(packageName)
                    && process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
                return true;
            }
        }
        return false;
    }

    private void showIncomingCallNotification(Map<String, String> data) {
        Context ctx = getApplicationContext();
        ensureChannel(ctx);

        String callId = data.get(EXTRA_CALL_ID);
        String conversationId = data.get(EXTRA_CONVERSATION_ID);
        String callerId = data.get(EXTRA_CALLER_ID);
        String callerName = data.get(EXTRA_CALLER_NAME);
        String callerAvatar = data.get(EXTRA_CALLER_AVATAR);
        String callType = data.get(EXTRA_CALL_TYPE);
        boolean isVideo = "video".equals(callType);

        if (callId == null) return;
        int notificationId = callId.hashCode();
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        Intent answerIntent = new Intent(ctx, MainActivity.class);
        answerIntent.setAction(Intent.ACTION_VIEW);
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        answerIntent.putExtra("callAction", "accept");
        answerIntent.putExtra(EXTRA_CALL_ID, callId);
        answerIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
        answerIntent.putExtra(EXTRA_CALLER_ID, callerId);
        answerIntent.putExtra(EXTRA_CALLER_NAME, callerName);
        answerIntent.putExtra(EXTRA_CALLER_AVATAR, callerAvatar);
        answerIntent.putExtra(EXTRA_CALL_TYPE, callType);
        PendingIntent answerPendingIntent = PendingIntent.getActivity(ctx, notificationId, answerIntent, piFlags);

        Intent declineIntent = new Intent(ctx, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
        declineIntent.putExtra(EXTRA_CALL_ID, callId);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(ctx, notificationId + 1, declineIntent, piFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CALL_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_call_incoming)
            .setContentTitle("Incoming " + (isVideo ? "video" : "voice") + " call")
            .setContentText(callerName != null && !callerName.isEmpty() ? callerName : "Someone is calling you")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(true)
            .setFullScreenIntent(answerPendingIntent, true)
            .setContentIntent(answerPendingIntent)
            .addAction(0, "Decline", declinePendingIntent)
            .addAction(0, "Answer", answerPendingIntent)
            .setTimeoutAfter(60000);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(notificationId, builder.build());
        }
    }

    // Nothing in the app ever created the "calls" notification channel
    // that send-call-push used to target (android.notification.channel_id
    // = 'calls'). On Android 8+, notifying against an undefined channel
    // is silently dropped — a second, previously-invisible reason calls
    // could fail to show at all. Created here, once, the first time it's
    // needed.
    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && nm.getNotificationChannel(CALL_CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                    CALL_CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Incoming voice and video calls");
                channel.enableVibration(true);
                Uri ringtone = Settings.System.DEFAULT_RINGTONE_URI;
                AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                channel.setSound(ringtone, attrs);
                nm.createNotificationChannel(channel);
            }
        }
    }
}
