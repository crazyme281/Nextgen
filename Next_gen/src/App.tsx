import React, { useEffect } from 'react';
import { IonApp, IonRouterOutlet, setupIonicReact, useIonRouter } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, useHistory, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { isAppLocked, isFingerprintEnrollmentInProgress } from '@/lib/biometric';
import { I18nProvider, LanguageBoundary } from '@/i18n';
import { CallProvider } from '@/context/CallContext';
import { MessagingProvider } from '@/context/MessagingProvider';
import BiometricGate from '@/components/BiometricGate';

import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import VerifyOtp from '@/pages/auth/VerifyOtp';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import Tabs from '@/pages/Tabs';
import ChatRoom from '@/pages/chats/ChatRoom';
import NewGroup from '@/pages/chats/NewGroup';
import NewBroadcast from '@/pages/chats/NewBroadcast';
import LinkedDevices from '@/pages/chats/LinkedDevices';
import LinkDeviceQR from '@/pages/chats/LinkDeviceQR';
import LinkDeviceEmail from '@/pages/chats/LinkDeviceEmail';
import LinkDeviceSuccess from '@/pages/chats/LinkDeviceSuccess';
import AddContact from '@/pages/chats/Addcontact';
import ContactsBrowse from '@/pages/chats/Contactsbrowse';
import Starred from '@/pages/chats/Starred';
import CallScreen from '@/pages/calls/CallScreen';
import ContactInfo from '@/pages/chats/ContactInfo';
import MediaGallery from '@/pages/chats/MediaGallery';
import CreateStory from '@/pages/stories/CreateStory';
import StoryViewer from '@/pages/stories/StoryViewer';
import MarketHome from '@/pages/market/MarketHome';
import ProductDetail from '@/pages/market/ProductDetail';
import GamesHome from '@/pages/games/GamesHome';
import GameRoom from '@/pages/games/GameRoom';
import Send from '@/pages/pay/Send';
import TopUp from '@/pages/pay/TopUp';
import Requests from '@/pages/pay/Requests';
import Request from '@/pages/pay/Request';
import Cards from '@/pages/pay/Cards';
import ClaimDevice from '@/pages/ClaimDevice';
import { ChatPage as AIChatPage } from '@/pages/ai/ChatPage';
import { ImagesPage as AIImagesPage, HistoryPage as AIHistoryPage, SettingsPage as AISettingsPage } from '@/pages/ai/SectionPages';


// hardwareBackButton is off because AndroidBackButtonHandler below owns the Android back button end to
// end (overlays first, then in-app history, then exit). Leaving Ionic's own handler on as well made the
// two fight over the same press.
setupIonicReact({ mode: 'ios', hardwareBackButton: false });

const PrivateRoute: React.FC<{ path: string; exact?: boolean; component: React.ComponentType<any> }> = ({
  component: Component,
  ...rest
}) => {
  // `user` (not `session`): when the app is opened with no internet the real
  // Supabase session can't be restored yet, but the on-device identity can —
  // that's what lets saved messages be read offline instead of bouncing to /login.
  const { user, loading } = useAuth();
  return (
    <Route
      {...rest}
      render={(props) => {
        if (loading) return null;
        return user ? <Component {...props} /> : <Redirect to="/login" />;
      }}
    />
  );
};

// '/forgot-password' and '/reset-password' are deliberately NOT here: the recovery link signs the user in
// (that session is what authorises choosing a new password), and bouncing them into the app at that
// moment made it impossible to ever finish a reset.
const PUBLIC_AUTH_PATHS = ['/login', '/register', '/verify-otp'];

/**
 * Fixes: right after creating an account (or verifying an OTP, or
 * resetting a password), the page immediately calls router.push('/tabs/
 * chats') — but that push races AuthContext's own session update, which
 * only lands a moment later via the async onAuthStateChange listener. If
 * PrivateRoute's guard renders before that state catches up, it sees
 * session === null and redirects straight back to /login — with nothing
 * to send the user forward again once the real session does arrive a
 * beat later. It genuinely looked stuck (a full app restart "fixed" it
 * only because that forces AuthContext to call getSession() fresh, which
 * reads the session that was actually already there in storage).
 *
 * This makes AuthContext's session state the single source of truth:
 * whenever a session is present while sitting on any public auth page,
 * leave for /tabs/chats — regardless of whether the page's own
 * navigation call won or lost that race. Each page's own router.push
 * after signUp/verifyOtp/signIn stays in place as a fast path; this is
 * the guaranteed-correct fallback that makes the whole class of races
 * harmless everywhere at once instead of patching each page separately.
 */
const AuthRedirectGuard: React.FC = () => {
  const { user, loading } = useAuth();
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user && !isFingerprintEnrollmentInProgress() && PUBLIC_AUTH_PATHS.includes(location.pathname)) {
      history.replace('/tabs/chats');
    }
  }, [user, loading, location.pathname, history]);

  return null;
};

// Android hardware back button — one handler for the whole app.
//  1. If a modal / popover / alert / action sheet is open, close it.
//  2. Otherwise go back through the app's own navigation history (the same history the on-screen back
//     buttons use, via Ionic's router), so both always agree.
//  3. Only at the true root (nothing to go back to) leave the app.
// The previous version tested `window.history.state.idx`, which only exists in react-router v6 — this app
// is on v5, so that was always undefined and every back press closed the app.
const OVERLAY_SELECTOR = 'ion-action-sheet, ion-alert, ion-popover, ion-modal';

const AndroidBackButtonHandler: React.FC = () => {
  const router = useIonRouter();
  const routerRef = React.useRef(router);
  routerRef.current = router;

  useEffect(() => {
    let listenerHandle: { remove: () => void } | undefined;
    let cancelled = false;

    import('@capacitor/app').then(({ App: CapacitorApp }) => {
      if (cancelled) return;
      CapacitorApp.addListener('backButton', () => {
        if (isAppLocked()) {
          CapacitorApp.exitApp();
          return;
        }
        const overlays = Array.from(document.querySelectorAll(OVERLAY_SELECTOR)) as Array<HTMLElement & { dismiss?: () => unknown }>;
        const top = overlays[overlays.length - 1];
        if (top && typeof top.dismiss === 'function') {
          top.dismiss();
          return;
        }
        if (routerRef.current.canGoBack()) {
          routerRef.current.goBack();
        } else {
          CapacitorApp.exitApp();
        }
      }).then((handle) => {
        if (cancelled) handle.remove();
        else listenerHandle = handle;
      });
    });

    return () => {
      cancelled = true;
      listenerHandle?.remove();
    };
  }, []);

  return null;
};

/**
 * Password-reset email link. The email opens `com.nextgen.app://reset-password#access_token=...&refresh_token=...`
 * (see ForgotPassword.tsx + the intent-filter in AndroidManifest.xml). The tokens are handed to Supabase
 * to establish the recovery session, then the user lands on the "set a new password" screen.
 */
const DeepLinkHandler: React.FC = () => {
  const router = useIonRouter();
  const routerRef = React.useRef(router);
  routerRef.current = router;

  useEffect(() => {
    let handle: { remove: () => void } | undefined;
    let cancelled = false;

    import('@capacitor/app').then(({ App: CapacitorApp }) => {
      if (cancelled) return;
      CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url.includes('reset-password')) return;
        const fragment = url.includes('#') ? url.split('#')[1] : (url.split('?')[1] ?? '');
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const code = params.get('code');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        } else if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
        // Mark this session as coming from the recovery email so /reset-password accepts it.
        sessionStorage.setItem('ng.recoveryPending', '1');
        routerRef.current.push('/reset-password', 'root', 'replace');
      }).then((h) => {
        if (cancelled) h.remove();
        else handle = h;
      });
    });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, []);

  return null;
};

const Routes: React.FC = () => (
  <IonReactRouter>
    <CallProvider>
      <MessagingProvider>
      <AuthRedirectGuard />
      <AndroidBackButtonHandler />
      <DeepLinkHandler />
      <IonRouterOutlet>
        <Route exact path="/login" component={Login} />
        <Route exact path="/register" component={Register} />
        <Route exact path="/verify-otp" component={VerifyOtp} />
        <Route exact path="/forgot-password" component={ForgotPassword} />
        <Route exact path="/reset-password" component={ResetPassword} />
        <Route exact path="/claim-device" component={ClaimDevice} />
        <PrivateRoute path="/tabs" component={Tabs} />
        <PrivateRoute exact path="/chats/new-group" component={NewGroup} />
        <PrivateRoute exact path="/chats/new-broadcast" component={NewBroadcast} />
        <PrivateRoute exact path="/chats/linked-devices" component={LinkedDevices} />
        <PrivateRoute exact path="/chats/link-device-qr" component={LinkDeviceQR} />
        <PrivateRoute exact path="/chats/link-device-email" component={LinkDeviceEmail} />
        <PrivateRoute exact path="/chats/link-device-success" component={LinkDeviceSuccess} />
        <PrivateRoute exact path="/chats/add-contact" component={AddContact} />
        <PrivateRoute exact path="/chats/contacts-browse" component={ContactsBrowse} />
        <PrivateRoute exact path="/chats/starred" component={Starred} />
        <PrivateRoute exact path="/chats/room/:conversationId" component={ChatRoom} />
        <PrivateRoute exact path="/chats/room/:conversationId/contact" component={ContactInfo} />
        <PrivateRoute exact path="/chats/room/:conversationId/media" component={MediaGallery} />
        <PrivateRoute exact path="/chats/story/new" component={CreateStory} />
        <PrivateRoute exact path="/chats/story/view/:authorId" component={StoryViewer} />
        <PrivateRoute exact path="/calls/room/:callId" component={CallScreen} />
        <PrivateRoute exact path="/market/product/:productId" component={ProductDetail} />
        <PrivateRoute exact path="/market/shop" component={MarketHome} />
        <PrivateRoute exact path="/games" component={GamesHome} />
        <PrivateRoute exact path="/games/play/:gameKey" component={GameRoom} />
        <PrivateRoute exact path="/games/play/:gameKey/:matchId" component={GameRoom} />
        <PrivateRoute exact path="/pay/send" component={Send} />
        <PrivateRoute exact path="/pay/topup" component={TopUp} />
        <PrivateRoute exact path="/pay/requests" component={Requests} />
        <PrivateRoute exact path="/pay/request" component={Request} />
        <PrivateRoute exact path="/pay/cards" component={Cards} />
        {/* No sidebar/rail and no AIHome shell — every /ai destination is
            a plain page routed directly here, and both /ai and /ai/chat/:id
            land straight on the chat itself. */}
        <PrivateRoute exact path="/ai" component={AIChatPage} />
        <PrivateRoute exact path="/ai/chat/:conversationId" component={AIChatPage} />
        <PrivateRoute exact path="/ai/images" component={AIImagesPage} />
        <PrivateRoute exact path="/ai/history" component={AIHistoryPage} />
        <PrivateRoute exact path="/ai/settings" component={AISettingsPage} />
        <Route exact path="/">
          <Redirect to="/tabs/chats" />
        </Route>
      </IonRouterOutlet>
      </MessagingProvider>
    </CallProvider>
  </IonReactRouter>
);

const App: React.FC = () => (
  <IonApp>
    <I18nProvider>
      <AuthProvider>
        <LanguageBoundary><Routes /></LanguageBoundary>
        <BiometricGate />
      </AuthProvider>
    </I18nProvider>
  </IonApp>
);

export default App;