import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol,
  IonCard, IonCardContent, IonImg, IonSearchbar, IonButtons,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

interface Product {
  id: string;
  title: string;
  price_minor: number;
  currency: string;
  image_url: string | null;
}

const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(minor / 100);

const MarketHome: React.FC = () => {
  const history = useHistory();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('products').select('id,title,price_minor,currency,image_url')
      .eq('is_active', true).order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => data && setProducts(data as unknown as Product[]));
  }, []);

  const filtered = products.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <BrandMark size={26} className="ng-header-logo" />
          </IonButtons>
          <IonTitle className="ng-grad-text">{tr('J Market')}</IonTitle>
        </IonToolbar>
        <IonToolbar><IonSearchbar value={search} onIonInput={(e) => setSearch(e.detail.value ?? '')} /></IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="ion-padding">
        <IonGrid>
          <IonRow>
            {filtered.map((p) => (
              <IonCol size="6" key={p.id}>
                <IonCard button onClick={() => history.push(`/market/product/${p.id}`)}>
                  <IonImg src={p.image_url ?? undefined} style={{ aspectRatio: '1', background: 'var(--ion-item-background)' }} />
                  <IonCardContent>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                    <div style={{ color: 'var(--ng-blue)', fontWeight: 700 }}>{formatMoney(p.price_minor, p.currency)}</div>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
        {filtered.length === 0 && (
          <div className="ion-text-center ion-padding" style={{ color: 'var(--ion-color-medium)' }}>
            {tr('No products yet.')}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default MarketHome;
