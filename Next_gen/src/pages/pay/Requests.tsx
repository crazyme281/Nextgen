import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonNote, IonButton, IonSegment, IonSegmentButton, IonToast, IonFab, IonFabButton, IonIcon,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import BrandMark from '@/components/BrandMark';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n';

interface RequestRow {
  id: string;
  requester_id: string;
  payee_id: string;
  amount_minor: number;
  currency: string;
  description: string | null;
  status: 'pending' | 'paid' | 'declined' | 'cancelled';
  created_at: string;
  requester_name?: string;
  payee_name?: string;
}

const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(minor / 100);

const Requests: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    // profiles!requester_id / profiles!payee_id assume FK-named embeds are configured;
    // falls back to plain ids if your PostgREST embed names differ.
    const { data } = await supabase
      .from('payment_requests')
      .select('*, requester:profiles!payment_requests_requester_id_fkey(full_name), payee:profiles!payment_requests_payee_id_fkey(full_name)')
      .or(`requester_id.eq.${user.id},payee_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (data) {
      setRows(
        (data as any[]).map((r) => ({
          ...r,
          requester_name: r.requester?.full_name,
          payee_name: r.payee?.full_name,
        }))
      );
    }
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`payment-requests-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const received = rows.filter((r) => r.payee_id === user?.id);
  const sent = rows.filter((r) => r.requester_id === user?.id);

  const pay = async (r: RequestRow) => {
    setBusyId(r.id);
    const { error } = await supabase.rpc('fulfill_payment_request', { p_request_id: r.id });
    setBusyId(null);
    if (error) setToast(error.message);
    else setToast(`Paid ${formatMoney(r.amount_minor, r.currency)}`);
  };

  const decline = async (r: RequestRow) => {
    setBusyId(r.id);
    const { error } = await supabase.rpc('decline_payment_request', { p_request_id: r.id });
    setBusyId(null);
    if (error) setToast(error.message);
  };

  const cancel = async (r: RequestRow) => {
    setBusyId(r.id);
    const { error } = await supabase.from('payment_requests').update({ status: 'cancelled' }).eq('id', r.id);
    setBusyId(null);
    if (error) setToast(error.message);
  };

  const statusColor = (s: RequestRow['status']) =>
    s === 'paid' ? 'success' : s === 'declined' || s === 'cancelled' ? 'medium' : 'warning';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/pay" /> <BrandMark size={22} className="ng-header-logo" /></IonButtons>
          <IonTitle className="ng-grad-text">{tr('Requests')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={tab} onIonChange={(e) => setTab(e.detail.value as 'received' | 'sent')}>
            <IonSegmentButton value="received">{tr('Received')}</IonSegmentButton>
            <IonSegmentButton value="sent">{tr('Sent')}</IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          {(tab === 'received' ? received : sent).map((r) => (
            <IonItem key={r.id}>
              <IonLabel>
                <h2>{tab === 'received' ? r.requester_name ?? tr('Someone') : r.payee_name ?? tr('Someone')}</h2>
                <p>{r.description ?? tr('Payment request')}</p>
                <p>{new Date(r.created_at).toLocaleString()}</p>
              </IonLabel>
              <IonNote slot="end" color={statusColor(r.status)} style={{ marginRight: 8 }}>
                {formatMoney(r.amount_minor, r.currency)}
              </IonNote>
              {tab === 'received' && r.status === 'pending' && (
                <div slot="end" style={{ display: 'flex', gap: 4 }}>
                  <IonButton size="small" disabled={busyId === r.id} onClick={() => pay(r)}>{tr('Pay')}</IonButton>
                  <IonButton size="small" fill="outline" color="medium" disabled={busyId === r.id} onClick={() => decline(r)}>{tr('Decline')}</IonButton>
                </div>
              )}
              {tab === 'sent' && r.status === 'pending' && (
                <IonButton slot="end" size="small" fill="outline" color="medium" disabled={busyId === r.id} onClick={() => cancel(r)}>
                  {tr('Cancel')}
                </IonButton>
              )}
              {r.status !== 'pending' && (
                <IonNote slot="end" color={statusColor(r.status)} style={{ textTransform: 'capitalize' }}>
                  {r.status}
                </IonNote>
              )}
            </IonItem>
          ))}
        </IonList>
        {(tab === 'received' ? received : sent).length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('Nothing here yet.')}
          </div>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => history.push('/pay/request')}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2200} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default Requests;
