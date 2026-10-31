import React, { useState } from 'react';
import { IonIcon, useIonRouter } from '@ionic/react';
import { mailOutline, keypadOutline, arrowForwardOutline } from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import AuthShell from '@/components/AuthShell';
import { tr } from '@/i18n';

const VerifyOtp: React.FC = () => {
  const router = useIonRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    if (err) {
      setError(err.message);
      return;
    }
    router.push('/tabs/chats', 'root', 'replace');
  };

  return (
    <AuthShell
      title={tr('Verify your email')}
      subtitle={tr('Enter the code we sent to your email to activate your Nextgen account.')}
    >
      <div className="ng-field">
        <IonIcon icon={mailOutline} />
        <input
          type="email"
          placeholder={tr('Email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      <div className="ng-field">
        <IonIcon icon={keypadOutline} />
        <input
          type="text"
          inputMode="numeric"
          placeholder={tr('6-digit code')}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>

      {error && <div className="ng-error">{error}</div>}

      <button type="button" className="ng-btn-primary" onClick={verify} disabled={!email || !token}>
        {tr('Verify')}
        <IonIcon icon={arrowForwardOutline} style={{ position: 'absolute', right: 22 }} />
      </button>
    </AuthShell>
  );
};

export default VerifyOtp;
