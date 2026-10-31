import React from 'react';
import { IonContent, IonPage, IonBackButton, IonButtons } from '@ionic/react';
import BrandMark from './BrandMark';
import { tr } from '@/i18n';

/**
 * Shared visual shell for the auth flow (Register, ForgotPassword,
 * ResetPassword, VerifyOtp) so every screen in the flow matches the
 * login page's dark/light gradient mood, glow decoration, pill fields
 * and gradient button — without touching src/pages/auth/Login.tsx
 * itself. Scoped under .ng-auth so it never leaks into the rest of
 * the app; class names mirror Login's .ng-login recipe on purpose.
 */
const AuthShell: React.FC<{
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, backHref, children }) => (
  <IonPage>
    <IonContent fullscreen scrollY>
      <style>{`
        .ng-auth {
          --ngl-bg: radial-gradient(ellipse at 15% 10%, #120a24 0%, #0a0714 45%, #060410 100%);
          --ngl-glow-left: radial-gradient(circle, rgba(60,110,255,0.35) 0%, rgba(60,110,255,0) 70%);
          --ngl-glow-right: radial-gradient(circle, rgba(200,50,220,0.30) 0%, rgba(200,50,220,0) 70%);
          --ngl-arc-left: rgba(120,140,255,0.18);
          --ngl-arc-right: rgba(220,100,240,0.16);
          --ngl-tagline: rgba(200,198,212,0.55);
          --ngl-input-bg: rgba(255,255,255,0.04);
          --ngl-input-border: rgba(140,120,220,0.35);
          --ngl-input-shadow: none;
          --ngl-input-text: #EDEBF5;
          --ngl-placeholder: rgba(210,208,225,0.45);
          --ngl-icon: #8C7BFF;
          --ngl-back: #EDEBF5;
          --ngl-error: #FF6B6B;
          --ngl-success: #16A765;
        }
        @media (prefers-color-scheme: light) {
          .ng-auth {
            --ngl-bg: radial-gradient(ellipse at 15% 8%, #ffffff 0%, #f7f4fc 55%, #f2eefa 100%);
            --ngl-glow-left: radial-gradient(circle, rgba(80,120,255,0.14) 0%, rgba(80,120,255,0) 70%);
            --ngl-glow-right: radial-gradient(circle, rgba(210,60,220,0.12) 0%, rgba(210,60,220,0) 70%);
            --ngl-arc-left: rgba(120,140,255,0.20);
            --ngl-arc-right: rgba(220,100,240,0.18);
            --ngl-tagline: rgba(90,86,110,0.75);
            --ngl-input-bg: #ffffff;
            --ngl-input-border: #E4DFF0;
            --ngl-input-shadow: 0 1px 3px rgba(80,60,150,0.06);
            --ngl-input-text: #2A2438;
            --ngl-placeholder: #A29CB8;
            --ngl-icon: #7C3AED;
            --ngl-back: #2A2438;
            --ngl-error: #D92020;
            --ngl-success: #16A765;
          }
        }
        .ng-auth { position: relative; min-height: 100%; overflow: hidden; background: var(--ngl-bg); }
        .ng-auth .ng-glow-left {
          position: absolute; left: -140px; top: 12%; width: 280px; height: 280px; border-radius: 50%;
          background: var(--ngl-glow-left); pointer-events: none;
        }
        .ng-auth .ng-glow-right {
          position: absolute; right: -160px; top: 48%; width: 340px; height: 340px; border-radius: 50%;
          background: var(--ngl-glow-right); pointer-events: none;
        }
        .ng-auth .ng-arc-left {
          position: absolute; left: -190px; top: 6%; width: 380px; height: 380px; border-radius: 50%;
          border: 1px solid var(--ngl-arc-left); pointer-events: none;
        }
        .ng-auth .ng-arc-right {
          position: absolute; right: -200px; top: 58%; width: 400px; height: 400px; border-radius: 50%;
          border: 1px solid var(--ngl-arc-right); pointer-events: none;
        }
        .ng-auth .ng-back {
          position: relative; z-index: 2; --color: var(--ngl-back); padding: 4px 8px 0;
        }
        .ng-auth .ng-content-wrap {
          position: relative; z-index: 2; min-height: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 8px 26px 40px;
        }
        .ng-auth .ng-inner { width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; }
        .ng-auth .ng-wordmark {
          font-size: 20px; font-weight: 800; letter-spacing: 1.5px; margin-top: 10px;
          background: linear-gradient(90deg, #1FA6FF, #7A3DFF 55%, #E339D6);
          -webkit-background-clip: text; background-clip: text; color: transparent; text-align: center;
        }
        .ng-auth .ng-heading { font-size: 20px; font-weight: 700; margin-top: 18px; color: var(--ngl-input-text); text-align: center; }
        .ng-auth .ng-tagline { font-size: 13px; margin-top: 6px; margin-bottom: 22px; color: var(--ngl-tagline); text-align: center; line-height: 1.4; }
        .ng-auth .ng-field {
          width: 100%; min-height: 54px; border-radius: 27px; display: flex; align-items: center;
          padding: 0 18px; margin-bottom: 14px; background: var(--ngl-input-bg);
          border: 1px solid var(--ngl-input-border); box-shadow: var(--ngl-input-shadow);
        }
        .ng-auth .ng-field ion-icon { font-size: 20px; color: var(--ngl-icon); flex-shrink: 0; }
        .ng-auth .ng-field input, .ng-auth .ng-field textarea {
          border: none; outline: none; background: transparent; flex: 1; font-size: 15px;
          margin-left: 12px; color: var(--ngl-input-text); font-family: inherit; min-width: 0;
        }
        .ng-auth .ng-field input::placeholder { color: var(--ngl-placeholder); }
        .ng-auth .ng-eye { background: none; border: none; padding: 0; cursor: pointer; display: flex; }
        .ng-auth .ng-error { color: var(--ngl-error); font-size: 13px; text-align: center; margin: -2px 0 12px; width: 100%; }
        .ng-auth .ng-success-icon { font-size: 56px; color: var(--ngl-success); margin-bottom: 4px; }
        .ng-auth .ng-btn-primary {
          width: 100%; height: 54px; border-radius: 27px; margin-top: 6px; border: none; cursor: pointer;
          background: linear-gradient(90deg, #1FA6FF, #7A3DFF 55%, #E339D6);
          display: flex; align-items: center; justify-content: center; position: relative;
          color: #fff; font-size: 16px; font-weight: 700; font-family: inherit;
        }
        .ng-auth .ng-btn-primary:disabled { opacity: 0.6; cursor: default; }
        .ng-auth .ng-link {
          text-align: center; font-size: 14px; margin-top: 18px; font-weight: 500; color: #B98CFF;
          background: none; border: none; cursor: pointer; font-family: inherit;
        }
        @media (prefers-color-scheme: light) { .ng-auth .ng-link { color: #8B2FE0; } }
      `}
      </style>

      <div className="ng-auth">
        <div className="ng-glow-left" />
        <div className="ng-glow-right" />
        <div className="ng-arc-left" />
        <div className="ng-arc-right" />

        {backHref && (
          <IonButtons className="ng-back">
            <IonBackButton defaultHref={backHref} text="Back" />
          </IonButtons>
        )}

        <div className="ng-content-wrap">
          <div className="ng-inner">
            <BrandMark size={64} />
            <div className="ng-wordmark">{tr('NEXT GEN')}</div>
            <div className="ng-heading">{title}</div>
            {subtitle && <div className="ng-tagline">{subtitle}</div>}
            {!subtitle && <div style={{ marginBottom: 22 }} />}
            {children}
          </div>
        </div>
      </div>
    </IonContent>
  </IonPage>
);

export default AuthShell;
