package com.nextgen.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBarInsets();
        dispatchCallIntentIfPresent(getIntent());
    }

    // Targeting API 35+ makes Android draw the app edge-to-edge, i.e. UNDER the
    // status bar and the gesture/navigation bar. Capacitor 6's WebView doesn't
    // compensate, so headers and back buttons ended up behind the status bar
    // (untappable) and bottom bars behind the navigation bar. This pads the
    // content view by the real system-bar sizes (and the keyboard, so inputs stay
    // visible), which makes every screen sit correctly on any phone — notch,
    // punch-hole, 3-button or gesture navigation — with no per-screen changes.
    private void applySystemBarInsets() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        // The app's base palette is dark, so keep the status/navigation icons light.
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
        ViewCompat.requestApplyInsets(content);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchCallIntentIfPresent(intent);
    }

    // Forwards the extras CallMessagingService attaches to the "Answer"
    // PendingIntent into the WebView as a plain DOM CustomEvent, so
    // CallContext.tsx can join the call room the same way it does for the
    // in-app Accept button. Delayed slightly on cold start so it fires
    // after the WebView has actually finished loading the app and
    // attached its listener — harmless no-op if there was nothing to
    // forward.
    private void dispatchCallIntentIfPresent(Intent intent) {
        if (intent == null || !"accept".equals(intent.getStringExtra("callAction"))) return;
        try {
            JSONObject detail = new JSONObject();
            detail.put("callId", intent.getStringExtra(CallMessagingService.EXTRA_CALL_ID));
            detail.put("conversationId", intent.getStringExtra(CallMessagingService.EXTRA_CONVERSATION_ID));
            detail.put("callerId", intent.getStringExtra(CallMessagingService.EXTRA_CALLER_ID));
            detail.put("callerName", intent.getStringExtra(CallMessagingService.EXTRA_CALLER_NAME));
            detail.put("callerAvatar", intent.getStringExtra(CallMessagingService.EXTRA_CALLER_AVATAR));
            detail.put("callType", intent.getStringExtra(CallMessagingService.EXTRA_CALL_TYPE));
            String js = "window.dispatchEvent(new CustomEvent('nextgenIncomingCallAnswer', { detail: " + detail.toString() + " }));";
            getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript(js, null), 300);
        } catch (Exception ignored) {
            // Best-effort — a malformed/partial intent here just means no
            // call gets joined automatically; the person can still open
            // the app normally.
        }
    }
}
