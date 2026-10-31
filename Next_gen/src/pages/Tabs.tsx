import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/react';
import {
  chatbubbleEllipses, call, radio, people, wallet, appsOutline,
} from 'ionicons/icons';

import ChatsList from '@/pages/chats/ChatsList';
import CallsList from '@/pages/calls/CallsList';
import LiveFeed from '@/pages/live/LiveFeed';
import ContactsList from '@/pages/contacts/ContactsList';
import Wallet from '@/pages/pay/Wallet';
import MarketplaceHub from '@/pages/market/MarketplaceHub';
import Settings from '@/pages/settings/Settings';
import Profile from '@/pages/settings/Profile';
import AccountProfile from '@/pages/settings/AccountProfile';
import { tr } from '@/i18n';

const Tabs: React.FC = () => (
  <IonTabs>
    <IonRouterOutlet>
      <Route exact path="/tabs/chats" component={ChatsList} />
      <Route exact path="/tabs/calls" component={CallsList} />
      <Route exact path="/tabs/live" component={LiveFeed} />
      <Route exact path="/tabs/contacts" component={ContactsList} />
      <Route exact path="/tabs/pay" component={Wallet} />
      <Route exact path="/tabs/market" component={MarketplaceHub} />
      <Route exact path="/tabs/settings" component={Settings} />
      <Route exact path="/tabs/account" component={AccountProfile} />
      <Route exact path="/tabs/profile" component={Profile} />
      <Route exact path="/tabs">
        <Redirect to="/tabs/chats" />
      </Route>
    </IonRouterOutlet>

    <IonTabBar slot="bottom">
      <IonTabButton tab="calls" href="/tabs/calls">
        <IonIcon icon={call} />
        <IonLabel>{tr('Calls')}</IonLabel>
      </IonTabButton>
      <IonTabButton tab="chats" href="/tabs/chats">
        <IonIcon icon={chatbubbleEllipses} />
        <IonLabel>{tr('Chats')}</IonLabel>
      </IonTabButton>
      <IonTabButton tab="live" href="/tabs/live">
        <IonIcon icon={radio} />
        <IonLabel>{tr('Live')}</IonLabel>
      </IonTabButton>
      <IonTabButton tab="market" href="/tabs/market">
        <IonIcon icon={appsOutline} />
        <IonLabel>{tr('Activities')}</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
);

export default Tabs;