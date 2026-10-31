import React, { useState } from 'react';
import {
  IonContent, IonPage, IonIcon, IonLoading, useIonRouter, useIonAlert,
} from '@ionic/react';
import { offerFingerprintEnrollment } from '@/lib/fingerprintEnroll';
import { rememberLoginEmail } from '@/lib/biometric';
import {
  personOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
  arrowForwardOutline, personAddOutline,
} from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import LanguagePicker from '@/components/LanguagePicker';
import { tr } from '@/i18n';

/**
 * Brand mark: gradient ribbon "N" with two chat-bubble accents.
 * Rendered inline so it always tracks the current gradient/theme with no
 * extra asset request.
 */
const NextGenLogo: React.FC = () => (
  <svg viewBox="0 0 220 220" width="112" height="112" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ngGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#17C9FF" />
        <stop offset="38%" stopColor="#3D6BFF" />
        <stop offset="66%" stopColor="#8A3DFF" />
        <stop offset="100%" stopColor="#E339D6" />
      </linearGradient>
      <linearGradient id="ngGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22D2FF" />
        <stop offset="100%" stopColor="#2A5CFF" />
      </linearGradient>
      <linearGradient id="ngGradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9A3DFF" />
        <stop offset="100%" stopColor="#FF3ED2" />
      </linearGradient>
    </defs>

    <path
      d="M50 40 C50 34 54 30 60 30 L74 30 C80 30 84 34 84 40 L84 170 C84 176 80 180 74 180 L60 180 C54 180 50 176 50 170 Z"
      fill="url(#ngGradBlue)"
    />
    <path
      d="M50 155 L84 140 L84 170 C84 176 80 180 74 180 L60 180 C54 180 50 176 50 170 Z"
      fill="#1442B8"
      opacity="0.35"
    />
    <path
      d="M50 40 C50 34 54 30 60 30 C66 30 71 33 74 38 L168 172 C171 177 169 184 163 187 C157 190 150 188 147 183 L54 50 C51 47 50 43 50 40 Z"
      fill="url(#ngGrad)"
    />
    <path
      d="M136 60 C136 54 140 50 146 50 L160 50 C166 50 170 54 170 60 L170 150 C170 156 166 160 160 160 L146 160 C140 160 136 156 136 150 Z"
      fill="url(#ngGradPurple)"
    />
    <path
      d="M136 135 L170 120 L170 150 C170 156 166 160 160 160 L146 160 C140 160 136 156 136 150 Z"
      fill="#7A0FBE"
      opacity="0.3"
    />

    <path
      d="M28 145 h44 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 h-22 l-12 12 v-12 h-10 a10 10 0 0 1 -10 -10 v-22 a10 10 0 0 1 10 -10 Z"
      fill="url(#ngGradBlue)"
    />
    <circle cx="40" cy="171" r="3" fill="#ffffff" />
    <circle cx="50" cy="171" r="3" fill="#ffffff" />
    <circle cx="60" cy="171" r="3" fill="#ffffff" />

    <path
      d="M148 26 h38 a10 10 0 0 1 10 10 v18 a10 10 0 0 1 -10 10 h-8 v10 l-12 -10 h-18 a10 10 0 0 1 -10 -10 v-18 a10 10 0 0 1 10 -10 Z"
      fill="url(#ngGradPurple)"
    />
    <circle cx="160" cy="45" r="3" fill="#ffffff" />
    <circle cx="170" cy="45" r="3" fill="#ffffff" />
    <circle cx="180" cy="45" r="3" fill="#ffffff" />

    <g strokeLinecap="round">
      <line x1="196" y1="60" x2="216" y2="60" stroke="#FF3ED2" strokeWidth="4" opacity="0.9" />
      <line x1="196" y1="72" x2="212" y2="72" stroke="#FF3ED2" strokeWidth="4" opacity="0.65" />
      <line x1="196" y1="84" x2="206" y2="84" stroke="#FF3ED2" strokeWidth="4" opacity="0.4" />
      <circle cx="196" cy="96" r="2.5" fill="#FF3ED2" opacity="0.5" />
      <circle cx="203" cy="103" r="2" fill="#FF3ED2" opacity="0.3" />
    </g>
  </svg>
);

const Login: React.FC = () => {
  const router = useIonRouter();
  const [presentAlert] = useIonAlert();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    rememberLoginEmail(email.trim());
    // Offer fingerprint login (first sign-in on this device / after a logout), wait for the answer, and
    // only then go into the app — one continuous flow, nothing to restart afterwards.
    if (data.user) {
      const result = await offerFingerprintEnrollment(data.user.id, presentAlert);
      if (result === 'failed') setError(tr("Fingerprint wasn't confirmed, so it was not turned on. You can enable it later in Settings."));
    }
    router.push('/tabs/chats', 'root', 'replace');
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY>
        {/* Scoped styling so the rest of the app is unaffected; automatically
            follows the device/browser color-scheme preference. */}
        <style>{`
          .ng-login {
            --ngl-bg: radial-gradient(ellipse at 15% 10%, #120a24 0%, #0a0714 45%, #060410 100%);
            --ngl-glow-left: radial-gradient(circle, rgba(60,110,255,0.35) 0%, rgba(60,110,255,0) 70%);
            --ngl-glow-right: radial-gradient(circle, rgba(200,50,220,0.30) 0%, rgba(200,50,220,0) 70%);
            --ngl-arc-left: rgba(120,140,255,0.18);
            --ngl-arc-right: rgba(220,100,240,0.16);
            --ngl-dot: rgba(150,140,255,0.55);
            --ngl-lang: rgba(230,228,240,0.55);
            --ngl-tagline: rgba(200,198,212,0.55);
            --ngl-input-bg: rgba(255,255,255,0.04);
            --ngl-input-border: rgba(140,120,220,0.35);
            --ngl-input-shadow: none;
            --ngl-input-text: #EDEBF5;
            --ngl-placeholder: rgba(210,208,225,0.45);
            --ngl-icon: #8C7BFF;
            --ngl-divider-line: rgba(255,255,255,0.12);
            --ngl-divider-text: rgba(200,198,212,0.5);
            --ngl-outline-bg: #0d0a1a;
            --ngl-outline-text: #F2F0FA;
            --ngl-forgot: #B98CFF;
            --ngl-error: #FF6B6B;
          }
          @media (prefers-color-scheme: light) {
            .ng-login {
              --ngl-bg: radial-gradient(ellipse at 15% 8%, #ffffff 0%, #f7f4fc 55%, #f2eefa 100%);
              --ngl-glow-left: radial-gradient(circle, rgba(80,120,255,0.14) 0%, rgba(80,120,255,0) 70%);
              --ngl-glow-right: radial-gradient(circle, rgba(210,60,220,0.12) 0%, rgba(210,60,220,0) 70%);
              --ngl-arc-left: rgba(120,140,255,0.20);
              --ngl-arc-right: rgba(220,100,240,0.18);
              --ngl-dot: rgba(120,110,220,0.45);
              --ngl-lang: rgba(60,55,80,0.75);
              --ngl-tagline: rgba(90,86,110,0.75);
              --ngl-input-bg: #ffffff;
              --ngl-input-border: #E4DFF0;
              --ngl-input-shadow: 0 1px 3px rgba(80,60,150,0.06);
              --ngl-input-text: #2A2438;
              --ngl-placeholder: #A29CB8;
              --ngl-icon: #7C3AED;
              --ngl-divider-line: #E4DFF0;
              --ngl-divider-text: #9B94AE;
              --ngl-outline-bg: #ffffff;
              --ngl-outline-text: #7C22CC;
              --ngl-forgot: #8B2FE0;
              --ngl-error: #D92020;
            }
          }
          .ng-login { position: relative; min-height: 100%; overflow: hidden; background: var(--ngl-bg); }
          .ng-login .ng-glow-left {
            position: absolute; left: -140px; top: 12%; width: 280px; height: 280px; border-radius: 50%;
            background: var(--ngl-glow-left); pointer-events: none;
          }
          .ng-login .ng-glow-right {
            position: absolute; right: -160px; top: 48%; width: 340px; height: 340px; border-radius: 50%;
            background: var(--ngl-glow-right); pointer-events: none;
          }
          .ng-login .ng-arc-left {
            position: absolute; left: -190px; top: 6%; width: 380px; height: 380px; border-radius: 50%;
            border: 1px solid var(--ngl-arc-left); pointer-events: none;
          }
          .ng-login .ng-arc-right {
            position: absolute; right: -200px; top: 58%; width: 400px; height: 400px; border-radius: 50%;
            border: 1px solid var(--ngl-arc-right); pointer-events: none;
          }
          .ng-login .ng-dotgrid { position: absolute; left: 16px; top: 14px; width: 110px; height: 130px; pointer-events: none; }
          .ng-login .ng-dotgrid span { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: var(--ngl-dot); }
          .ng-login .ng-content-wrap {
            position: relative; z-index: 2; min-height: 100%; display: flex; flex-direction: column;
            align-items: center; justify-content: center; padding: 24px 26px 40px;
          }
          .ng-login .ng-inner { width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; }
          .ng-login .ng-lang {
            display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--ngl-lang);
            margin-bottom: 18px; background: none; border: none; padding: 0; cursor: pointer;
          }
          .ng-login .ng-wordmark {
            font-size: 34px; font-weight: 800; letter-spacing: 2px; margin-top: 6px;
            background: linear-gradient(90deg, #1FA6FF, #7A3DFF 55%, #E339D6);
            -webkit-background-clip: text; background-clip: text; color: transparent;
          }
          .ng-login .ng-tagline { font-size: 12px; letter-spacing: 3px; margin-top: 6px; margin-bottom: 28px; color: var(--ngl-tagline); }
          .ng-login .ng-field {
            width: 100%; height: 54px; border-radius: 27px; display: flex; align-items: center;
            padding: 0 18px; margin-bottom: 14px; background: var(--ngl-input-bg);
            border: 1px solid var(--ngl-input-border); box-shadow: var(--ngl-input-shadow);
          }
          .ng-login .ng-field ion-icon { font-size: 20px; color: var(--ngl-icon); flex-shrink: 0; }
          .ng-login .ng-field input {
            border: none; outline: none; background: transparent; flex: 1; font-size: 15px;
            margin-left: 12px; color: var(--ngl-input-text); font-family: inherit; min-width: 0;
          }
          .ng-login .ng-field input::placeholder { color: var(--ngl-placeholder); }
          .ng-login .ng-eye { background: none; border: none; padding: 0; cursor: pointer; display: flex; }
          .ng-login .ng-error { color: var(--ngl-error); font-size: 13px; text-align: center; margin: -2px 0 12px; width: 100%; }
          .ng-login .ng-btn-primary {
            width: 100%; height: 54px; border-radius: 27px; margin-top: 6px; border: none; cursor: pointer;
            background: linear-gradient(90deg, #1FA6FF, #7A3DFF 55%, #E339D6);
            display: flex; align-items: center; justify-content: center; position: relative;
            color: #fff; font-size: 16px; font-weight: 700; font-family: inherit;
          }
          .ng-login .ng-btn-primary:disabled { opacity: 0.6; cursor: default; }
          .ng-login .ng-btn-primary ion-icon { position: absolute; right: 22px; font-size: 20px; }
          .ng-login .ng-forgot {
            text-align: center; font-size: 14px; margin-top: 18px; font-weight: 500; color: var(--ngl-forgot);
            background: none; border: none; cursor: pointer; font-family: inherit;
          }
          .ng-login .ng-divider { display: flex; align-items: center; gap: 12px; width: 100%; margin: 26px 0 18px; }
          .ng-login .ng-divider .line { flex: 1; height: 1px; background: var(--ngl-divider-line); }
          .ng-login .ng-divider span.txt { font-size: 12px; letter-spacing: 1px; color: var(--ngl-divider-text); }
          .ng-login .ng-btn-outline {
            width: 100%; height: 54px; border-radius: 27px; padding: 2px; border: none; cursor: pointer;
            background: linear-gradient(90deg, #22B4FF, #8A4CFF 55%, #F23EDC); font-family: inherit;
          }
          .ng-login .ng-btn-outline-inner {
            width: 100%; height: 100%; border-radius: 25px; background: var(--ngl-outline-bg);
            display: flex; align-items: center; justify-content: center; gap: 10px;
            font-weight: 700; font-size: 15px; color: var(--ngl-outline-text);
          }
          .ng-login .ng-btn-outline-inner ion-icon { font-size: 19px; color: var(--ngl-icon); }
        `}
        </style>

        <div className="ng-login">
          <div className="ng-glow-left" />
          <div className="ng-glow-right" />
          <div className="ng-arc-left" />
          <div className="ng-arc-right" />
          <div className="ng-dotgrid">
            <span style={{ left: 0, top: 0 }} />
            <span style={{ left: 16, top: 0 }} />
            <span style={{ left: 32, top: 0 }} />
            <span style={{ left: 0, top: 16 }} />
            <span style={{ left: 16, top: 16 }} />
            <span style={{ left: 0, top: 32 }} />
            <span style={{ left: 0, top: 48 }} />
            <span style={{ left: 16, top: 48 }} />
            <span style={{ left: 0, top: 64 }} />
          </div>

          <div className="ng-content-wrap">
            <div className="ng-inner">
              <LanguagePicker />

              <NextGenLogo />
              <div className="ng-wordmark">{tr('NEXT GEN')}</div>
              <div className="ng-tagline">{tr('CONNECT. SHARE. EVOLVE.')}</div>

              <div className="ng-field">
                <IonIcon icon={personOutline} />
                <input
                  type="text"
                  placeholder={tr('Mobile number or email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>

              <div className="ng-field">
                <IonIcon icon={lockClosedOutline} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={tr('Password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="ng-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? tr('Hide password') : tr('Show password')}
                >
                  <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                </button>
              </div>

              {error && <div className="ng-error">{error}</div>}

              <button
                type="button"
                className="ng-btn-primary"
                onClick={handleLogin}
                disabled={busy || !email || !password}
              >
                {tr('Log in')}
                <IonIcon icon={arrowForwardOutline} />
              </button>

              <button type="button" className="ng-forgot" onClick={() => router.push('/forgot-password')}>
                {tr('Forgot password?')}
              </button>

              <div className="ng-divider">
                <span className="line" />
                <span className="txt">{tr('OR')}</span>
                <span className="line" />
              </div>

              <button type="button" className="ng-btn-outline" onClick={() => router.push('/register')}>
                <span className="ng-btn-outline-inner">
                  <IonIcon icon={personAddOutline} />
                  {tr('Create new account')}
                </span>
              </button>
            </div>
          </div>
        </div>

        <IonLoading isOpen={busy} message={tr('Signing in...')} />
      </IonContent>
    </IonPage>
  );
};

export default Login;