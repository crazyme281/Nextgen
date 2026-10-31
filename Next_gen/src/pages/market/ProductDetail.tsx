import React, { useEffect, useState } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonImg, IonButton, IonFooter, IonToast,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import BrandMark from '@/components/BrandMark';
import { tr } from '@/i18n';

interface Product {
  id: string; title: string; description: string | null;
  price_minor: number; currency: string; image_url: string | null; seller_id: string;
}

const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(minor / 100);

const ProductDetail: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('products').select('*').eq('id', productId).single()
      .then(({ data }) => data && setProduct(data as unknown as Product));
  }, [productId]);

  const order = async () => {
    if (!user || !product) return;
    const { error } = await supabase.from('orders').insert({
      product_id: product.id,
      buyer_id: user.id,
      seller_id: product.seller_id,
      amount_minor: product.price_minor,
      currency: product.currency,
      status: 'pending',
    });
    setToast(error ? error.message : tr('Order placed!'));
  };

  if (!product) return null;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/market" />
            <BrandMark size={22} className="ng-header-logo" />
          </IonButtons>
          <IonTitle>{product.title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonImg src={product.image_url ?? undefined} style={{ aspectRatio: '1', background: 'var(--ion-item-background)' }} />
        <div className="ion-padding">
          <h2>{product.title}</h2>
          <div style={{ color: 'var(--ng-blue)', fontWeight: 800, fontSize: 22 }}>
            {formatMoney(product.price_minor, product.currency)}
          </div>
          <p style={{ color: 'var(--ion-color-medium)' }}>{product.description}</p>
        </div>
      </IonContent>
      <IonFooter>
        <div className="ion-padding">
          <IonButton expand="block" className="ng-grad-btn" onClick={order}>{tr('Buy now')}</IonButton>
        </div>
      </IonFooter>
      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2000} onDidDismiss={() => setToast(null)} />
    </IonPage>
  );
};

export default ProductDetail;
