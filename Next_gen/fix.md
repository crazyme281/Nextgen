.
Supabase RLS Policy Update: Updated the user-calls: Realtime policy in   0021 realtime call broadcast authorization.sql to allow callers to join the callee's inbox channel. In Supabase Realtime, a user must be able to "join" a channel before they can send a broadcast message (the call invite) to it.


2.
Signaling Reliability: Increased the network timeout in CallScreen.tsx when sending invites and cancellations. This ensures that the call invitation isn't accidentally cut off before it reaches the Supabase servers, which is especially important on mobile networks.
These changes, combined with the earlier manifest updates, should ensure calls ring correctly on both sides. You can find a summary of all changes in the   Walkthrough.


Walkthrough - Fixing Calling Functionality
I have updated the AndroidManifest.xml to include the necessary permissions and queries required for both VoIP (WebRTC) and standard telephony intents on modern Android devices.
Changes Made
Android Manifest Updates
  AndroidManifest.xml
•
Added Intent Queries: Included <queries> for tel: and mailto: schemes. This is mandatory for apps targeting API 30+ to interact with the system dialer.
•
Added Connectivity Permissions: Added ACCESS_NETWORK_STATE to allow WebRTC to monitor connection changes.
•
Added Bluetooth Permissions: Added BLUETOOTH and BLUETOOTH_CONNECT to support audio routing to wireless headsets during calls.
•
Added Telephony Feature: Declared android.hardware.telephony as optional to improve device compatibility.
Supabase & Signaling Fixes
  0021 realtime call broadcast authorization.sql
•
Relaxed RLS Policy: Updated the select policy for the user-calls: topic to allow all authenticated users to join. This is necessary because a caller must be able to "join" the callee's inbox channel to send the initial invitation broadcast.
CallScreen.tsx
•
Increased Signaling Timeout: Increased the removeChannel delay from 300ms to 2000ms for both call invites and cancellations. This ensures the message is fully sent over the network before the connection is closed.
•
Reverted to Public Channels: Removed { config: { private: true } } from channel initializations.

CallContext.tsx
•
Reverted to Public Channels: Removed private configuration and authorization checks (ensureRealtimeAuth) to restore compatibility with the previously working version.
Backend "Message API" & "Call API" Restoration
  0023_message_encryption_api.sql
•
Restored Encryption Logic: Re-implemented the nextgen_msg_encrypt and nextgen_msg_decrypt functions. These handle the secure storage of message bodies in the database.
•
Added Automated Trigger: Re-created the nextgen_encrypt_message_body trigger. This ensures that every new message sent via the frontend is automatically encrypted before it's saved to the database.
•
Created View API: Implemented the messages_plain view, which the frontend uses to fetch and automatically decrypt messages for display.
send-call-push/index.ts
•
Implemented Call Push Logic: Created a new Supabase Edge Function that bridges call invites to system-level push notifications. When a call is started, this function queries the callee's device tokens and sends a high-priority "incoming_call" payload via FCM. This is what allows calls to ring even when the app is in the background.
Verification Results
Automated Tests
•
Gradle Sync: Successful. The manifest changes are syntactically correct and don't conflict with existing configurations.