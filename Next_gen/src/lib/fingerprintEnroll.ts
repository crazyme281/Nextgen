import type { AlertOptions } from '@ionic/react';
import { tr } from '@/i18n';
import {
  hasDeclinedFingerprintPrompt,
  isBiometricAvailable,
  isFingerprintEnabledFor,
  markFingerprintPromptDeclined,
  setFingerprintEnabled,
  setFingerprintEnrollmentInProgress,
  verifyFingerprint,
} from '@/lib/biometric';

export type EnrollResult = 'enabled' | 'skipped' | 'failed' | 'unavailable';

const offeredFor = new Set<string>();
type PresentAlert = (options: AlertOptions) => Promise<void> | void;

/**
 * The one-and-only "use your fingerprint?" step, shared by the login screen and the in-app fallback.
 *
 * It is awaited by the caller, so the sequence is deterministic: sign in -> (offer -> confirm fingerprint)
 * -> go to the app. Nothing is left half-finished waiting for the app to be reopened, and the router is
 * held back while it runs so the alert can't be torn down by a navigation. It never blocks sign-in: any
 * outcome other than 'enabled' just continues into the app.
 */
export async function offerFingerprintEnrollment(userId: string, presentAlert: PresentAlert): Promise<EnrollResult> {
  if (isFingerprintEnabledFor(userId) || hasDeclinedFingerprintPrompt() || offeredFor.has(userId)) return 'skipped';
  if (!(await isBiometricAvailable())) return 'unavailable';

  offeredFor.add(userId);
  setFingerprintEnrollmentInProgress(true);
  try {
    const wantsIt = await new Promise<boolean>((resolve) => {
      presentAlert({
        header: tr('Use your fingerprint?'),
        message: tr('Open Nextgen with your fingerprint from now on. It also works without internet, so you can read your saved messages offline.'),
        backdropDismiss: false,
        buttons: [
          { text: tr('Not now'), role: 'cancel', handler: () => resolve(false) },
          { text: tr('Enable'), handler: () => resolve(true) },
        ],
        onDidDismiss: () => resolve(false), // no-op if a button already resolved it
      });
    });

    if (!wantsIt) {
      markFingerprintPromptDeclined();
      return 'skipped';
    }
    const ok = await verifyFingerprint(tr('Confirm your fingerprint'));
    if (!ok) return 'failed';
    setFingerprintEnabled(userId, true);
    return 'enabled';
  } finally {
    setFingerprintEnrollmentInProgress(false);
  }
}
