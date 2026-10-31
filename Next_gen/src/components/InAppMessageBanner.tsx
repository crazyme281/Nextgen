import React, { useEffect } from 'react';
import { IonIcon } from '@ionic/react';
import { chatbubbleEllipses, close } from 'ionicons/icons';
import { tr } from '@/i18n';

export interface MessageNotice {
  /** Changes for every notice so the auto-dismiss timer restarts. */
  key: string;
  title: string;
  preview: string;
  /** Where tapping the banner goes. */
  path: string;
}

interface Props {
  notice: MessageNotice | null;
  onOpen: (notice: MessageNotice) => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4500;

/**
 * In-app message notification. Rendered by MessagingProvider, which only
 * ever shows it while the app is open and in the foreground (never as a
 * system/background notification), on whatever page the user happens to be on.
 */
const InAppMessageBanner: React.FC<Props> = ({ notice, onOpen, onDismiss }) => {
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <>
      <style>{`
        @keyframes ng-banner-in { from { transform: translateY(-120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .ng-msg-banner {
          position: fixed; left: 10px; right: 10px; z-index: 100000;
          top: calc(env(safe-area-inset-top, 0px) + 8px);
          display: flex; align-items: center; gap: 12px; padding: 12px 14px;
          border-radius: 16px; cursor: pointer;
          background: var(--ion-card-background, #1e1b2e); color: var(--ion-text-color, #fff);
          box-shadow: 0 6px 24px rgba(0,0,0,0.28); border: 1px solid rgba(138,61,255,0.35);
          animation: ng-banner-in 220ms ease-out;
        }
        .ng-msg-banner .ng-ico {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #1FA6FF, #7A3DFF 60%, #E339D6); color: #fff; font-size: 20px;
        }
        .ng-msg-banner .ng-txt { flex: 1; min-width: 0; }
        .ng-msg-banner .ng-title { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ng-msg-banner .ng-prev { font-size: 13px; opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ng-msg-banner .ng-x { background: none; border: none; color: inherit; opacity: 0.6; font-size: 20px; padding: 4px; display: flex; }
      `}</style>
      <div
        className="ng-msg-banner"
        role="status"
        aria-live="polite"
        onClick={() => onOpen(notice)}
      >
        <div className="ng-ico"><IonIcon icon={chatbubbleEllipses} /></div>
        <div className="ng-txt">
          <div className="ng-title">{notice.title}</div>
          <div className="ng-prev">{notice.preview}</div>
        </div>
        <button
          type="button"
          className="ng-x"
          aria-label={tr('Dismiss')}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          <IonIcon icon={close} />
        </button>
      </div>
    </>
  );
};

export default InAppMessageBanner;
