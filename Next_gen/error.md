22:02:48.748 Running build in Washington, D.C., USA (East) – iad1
22:02:48.749 Build machine configuration: 2 cores, 8 GB
22:02:48.801 Cloning github.com/crazyme281/Nextgen (Branch: main, Commit: 8a0802f)
22:02:48.803 Skipping build cache, deployment was triggered without cache.
22:02:49.332 Cloning completed: 530.000ms
22:02:49.360 Found .vercelignore
22:02:49.375 Removed 101 ignored files defined in .vercelignore
22:02:49.375   /Next_gen/.vscode/settings.json
22:02:49.375   /Next_gen/android/.gitignore
22:02:49.375   /Next_gen/android/app/.gitignore
22:02:49.375   /Next_gen/android/app/build.gradle
22:02:49.375   /Next_gen/android/app/capacitor.build.gradle
22:02:49.375   /Next_gen/android/app/google-services.json
22:02:49.375   /Next_gen/android/app/keystore.properties.example
22:02:49.375   /Next_gen/android/app/proguard-rules.pro
22:02:49.375   /Next_gen/android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java
22:02:49.375   /Next_gen/android/app/src/main/AndroidManifest.xml
22:02:49.905 Running "vercel build"
22:02:49.917 Vercel CLI 65.11.0
22:02:50.733 Warning: Detected "engines": { "node": ">=18.18" } in your `package.json` that will automatically upgrade when a new major Node.js Version is released. Learn More: https://vercel.link/node-version
22:02:50.745 Running "install" command: `npm install --no-audit --no-fund`...
22:02:51.655 npm warn Unknown env config "cache-dir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
22:02:54.343 npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
22:02:54.917 npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
22:02:54.990 npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
22:02:54.997 npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
22:02:55.020 npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
22:02:55.138 npm warn deprecated tar@6.2.1: Old versions of tar are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
22:02:55.774 npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
22:02:56.814 npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.
22:02:59.914 
22:02:59.914 added 446 packages in 9s
22:02:59.915 npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
22:02:59.915 npm warn install-scripts   esbuild@0.21.5 (postinstall: node install.js)
22:02:59.915 npm warn install-scripts
22:02:59.916 npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
22:03:00.293 npm warn Unknown env config "cache-dir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
22:03:00.311 
22:03:00.311 > nextgen@1.0.0 build
22:03:00.311 > tsc && vite build
22:03:00.311 
22:03:09.149 src/lib/Phonecontacts.ts(51,41): error TS2307: Cannot find module '@capacitor-community/contacts' or its corresponding type declarations.
22:03:09.149 src/lib/Phonecontacts.ts(57,67): error TS7006: Parameter 'c' implicitly has an 'any' type.
22:03:09.151 src/lib/Phonecontacts.ts(59,39): error TS7006: Parameter 'p' implicitly has an 'any' type.
22:03:09.151 src/lib/Phonecontacts.ts(60,39): error TS7006: Parameter 'e' implicitly has an 'any' type.
22:03:09.151 src/lib/Phonecontacts.ts(93,48): error TS2345: Argument of type '"match_phone_contacts"' is not assignable to parameter of type '"add_contact_by_phone" | "can_view_story" | "create_game_invitation" | "create_group_conversation" | "credit_wallet_from_webhook" | "decline_payment_request" | "delete_message_for_everyone" | ... 14 more ... | "verify_transaction_pin"'.
22:03:09.152 src/lib/Phonecontacts.ts(95,18): error TS2339: Property 'forEach' does not exist on type 'string | boolean | { accepted_at: string | null; created_at: string; declined_at: string | null; expires_at: string; game_id: string; id: string; invitation_token: string; match_id: string | null; recipient_email: string | null; recipient_id: string | null; sender_id: string; status: "declined" | ... 3 more ... | "c...'.
22:03:09.153   Property 'forEach' does not exist on type 'string'.
22:03:09.153 src/lib/Phonecontacts.ts(114,48): error TS2345: Argument of type '"find_user_by_email"' is not assignable to parameter of type '"add_contact_by_phone" | "can_view_story" | "create_game_invitation" | "create_group_conversation" | "credit_wallet_from_webhook" | "decline_payment_request" | "delete_message_for_everyone" | ... 14 more ... | "verify_transaction_pin"'.
22:03:09.153 src/lib/Phonecontacts.ts(116,18): error TS2352: Conversion of type 'string | boolean | { accepted_at: string | null; created_at: string; declined_at: string | null; expires_at: string; game_id: string; id: string; invitation_token: string; match_id: string | null; recipient_email: string | null; recipient_id: string | null; sender_id: string; status: "declined" | ... 3 more ... | "c...' to type '{ id: string; full_name: string | null; }[] | null' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
22:03:09.153   Type '{ ai_difficulty: "easy" | "medium" | "hard" | null; board_state: Json; created_at: string; created_by: string; current_turn_player_id: string | null; ended_at: string | null; ... 9 more ...; winner_id: string | null; }' is missing the following properties from type '{ id: string; full_name: string | null; }[]': length, pop, push, concat, and 28 more.
22:03:09.153 src/lib/Phonecontacts.ts(121,48): error TS2345: Argument of type '"match_phone_contacts"' is not assignable to parameter of type '"add_contact_by_phone" | "can_view_story" | "create_game_invitation" | "create_group_conversation" | "credit_wallet_from_webhook" | "decline_payment_request" | "delete_message_for_everyone" | ... 14 more ... | "verify_transaction_pin"'.
22:03:09.153 src/lib/Phonecontacts.ts(123,18): error TS2352: Conversion of type 'string | boolean | { accepted_at: string | null; created_at: string; declined_at: string | null; expires_at: string; game_id: string; id: string; invitation_token: string; match_id: string | null; recipient_email: string | null; recipient_id: string | null; sender_id: string; status: "declined" | ... 3 more ... | "c...' to type '{ id: string; full_name: string | null; }[] | null' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
22:03:09.153   Type '{ ai_difficulty: "easy" | "medium" | "hard" | null; board_state: Json; created_at: string; created_by: string; current_turn_player_id: string | null; ended_at: string | null; ... 9 more ...; winner_id: string | null; }' is missing the following properties from type '{ id: string; full_name: string | null; }[]': length, pop, push, concat, and 28 more.
22:03:09.153 src/pages/chats/Addcontact.tsx(14,33): error TS2307: Cannot find module '@/lib/phoneContacts' or its corresponding type declarations.
22:03:09.153 src/pages/chats/PhoneContacts.tsx(13,8): error TS2307: Cannot find module '@/lib/phoneContacts' or its corresponding type declarations.
22:03:09.153 src/pages/chats/PhoneContacts.tsx(50,30): error TS7006: Parameter 'a' implicitly has an 'any' type.
22:03:09.153 src/pages/chats/PhoneContacts.tsx(50,33): error TS7006: Parameter 'b' implicitly has an 'any' type.
22:03:09.197 Error: [BUILD_UTILS_SPAWN_2] Command "npm run build" exited with 2