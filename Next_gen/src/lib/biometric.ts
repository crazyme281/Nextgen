/**
 * Fingerprint unlock.
 *
 * Model: the user signs in with email + password ONCE, online. After that
 * the Supabase session stays on the device, and the fingerprint is what
 * lets them back in on every later app open — including with no internet,
 * which is why nothing here talks to the network. No password or token is
 * copied anywhere; the fingerprint only decides whether the already-signed-in
 * app is shown or covered by the lock screen.
 *
 * Logging out removes the "enabled" flag, so the next sign-in goes through
 * email + password again and the fingerprint is offered afresh.
 */
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from 'capacitor-native-biometric';

const ENABLED_KEY = 'ng.fingerprint.enabledFor'; // value: the user id it was enabled for
const DECLINED_KEY = 'ng.fingerprint.declined'; // "Not now" on the enrol prompt

/** True on a real Android/iOS build whose device has an enrolled fingerprint (or face). */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await NativeBiometric.isAvailable({ useFallback: false });
    return !!res.isAvailable;
  } catch {
    return false;
  }
}

let prompting = false;
/** True while the system fingerprint sheet is on screen (it briefly pauses the app; callers must ignore that). */
export function isFingerprintPrompting(): boolean {
  return prompting;
}

let enrolling = false;
/** True while the post-login "enable fingerprint?" step is running, so the router doesn't navigate mid-step. */
export function isFingerprintEnrollmentInProgress(): boolean {
  return enrolling;
}
export function setFingerprintEnrollmentInProgress(v: boolean): void {
  enrolling = v;
}

const LAST_EMAIL_KEY = 'ng.lastLoginEmail';
export function rememberLoginEmail(email: string): void {
  try { localStorage.setItem(LAST_EMAIL_KEY, email); } catch { /* ignore */ }
}
export function getRememberedLoginEmail(): string | null {
  try { return localStorage.getItem(LAST_EMAIL_KEY); } catch { return null; }
}

/** Shows the system fingerprint sheet. Resolves true only on a successful match. */
export async function verifyFingerprint(reason = 'Unlock Nextgen'): Promise<boolean> {
  prompting = true;
  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: 'Unlock Nextgen',
      subtitle: 'Use your fingerprint to continue',
      negativeButtonText: 'Cancel',
      useFallback: false,
      maxAttempts: 5,
    });
    return true;
  } catch {
    return false;
  } finally {
    prompting = false;
  }
}

export function getFingerprintEnabledUserId(): string | null {
  try { return localStorage.getItem(ENABLED_KEY); } catch { return null; }
}

export function isFingerprintEnabledFor(userId: string | null | undefined): boolean {
  return !!userId && getFingerprintEnabledUserId() === userId;
}

export function setFingerprintEnabled(userId: string, enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(ENABLED_KEY, userId);
      localStorage.removeItem(DECLINED_KEY);
    } else {
      localStorage.removeItem(ENABLED_KEY);
    }
  } catch { /* storage unavailable — nothing to do */ }
}

export function hasDeclinedFingerprintPrompt(): boolean {
  try { return localStorage.getItem(DECLINED_KEY) === '1'; } catch { return false; }
}

export function markFingerprintPromptDeclined(): void {
  try { localStorage.setItem(DECLINED_KEY, '1'); } catch { /* ignore */ }
}

export function clearFingerprintState(): void {
  try {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(DECLINED_KEY);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Lock-screen state (shared so other parts of the app can respect it) */
/* ------------------------------------------------------------------ */

let appLocked = false;
const lockListeners = new Set<(locked: boolean) => void>();

export function isAppLocked(): boolean {
  return appLocked;
}

export function setAppLocked(locked: boolean): void {
  if (appLocked === locked) return;
  appLocked = locked;
  lockListeners.forEach((fn) => fn(locked));
}

export function onAppLockChange(fn: (locked: boolean) => void): () => void {
  lockListeners.add(fn);
  return () => { lockListeners.delete(fn); };
}
