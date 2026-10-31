import React, { useState } from 'react';
import { IonIcon, IonLoading, useIonRouter } from '@ionic/react';
import {
  personOutline, callOutline, mailOutline, lockClosedOutline,
  eyeOutline, eyeOffOutline, arrowForwardOutline,
} from 'ionicons/icons';
import { supabase } from '@/lib/supabase';
import AuthShell from '@/components/AuthShell';
import { tr } from '@/i18n';

const Register: React.FC = () => {
  const router = useIonRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // profiles row is created automatically via the handle_new_user trigger (see migrations)
    if (data.session) {
      router.push('/tabs/chats', 'root', 'replace');
    } else {
      router.push('/verify-otp', 'forward');
    }
  };

  return (
    <AuthShell title={tr('Join Nextgen')} subtitle={tr('Your trusted digital interaction network.')} backHref="/login">
      <div className="ng-field">
        <IonIcon icon={personOutline} />
        <input
          type="text"
          placeholder={tr('Full name')}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div className="ng-field">
        <IonIcon icon={callOutline} />
        <input
          type="tel"
          placeholder={tr('Phone number')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

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
        onClick={handleRegister}
        disabled={busy || !email || !password || !fullName}
      >
        {tr('Create Account')}
        <IonIcon icon={arrowForwardOutline} style={{ position: 'absolute', right: 22 }} />
      </button>

      <button type="button" className="ng-link" onClick={() => router.push('/login')}>
        {tr('I already have an account')}
      </button>

      <IonLoading isOpen={busy} message={tr('Creating account...')} />
    </AuthShell>
  );
};

export default Register;
