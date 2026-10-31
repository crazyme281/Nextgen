import React, { useEffect, useRef, useState } from 'react';
import {
  IonPage, IonContent, IonIcon, IonButton, IonSpinner, IonToast, IonTextarea,
} from '@ionic/react';
import { close, imageOutline, sendOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/i18n';

const BACKGROUNDS = [
  'linear-gradient(135deg, #17C9FF, #3D6BFF)',
  'linear-gradient(135deg, #8A3DFF, #E339D6)',
  'linear-gradient(135deg, #FF6B6B, #FFB86B)',
  'linear-gradient(135deg, #16A765, #17C9FF)',
  'linear-gradient(135deg, #0A0714, #3D2B5C)',
];

const MAX_STORY_BYTES = 15 * 1024 * 1024; // 15MB

const CreateStory: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'text' | 'media'>('text');
  const [text, setText] = useState('');
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const autoOpenedRef = useRef(false);

  // Tapping "+" on My Story should behave like tapping the gallery
  // shortcut in a native camera app: go straight to the phone's own
  // photo/video picker, rather than landing on a blank text composer
  // first. If the person backs out of the picker without choosing
  // anything, they simply land on the text composer as a fallback —
  // nothing is lost, they can still tap "Photo / Video" themselves.
  useEffect(() => {
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    fileInputRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickMedia = () => fileInputRef.current?.click();

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setToast(tr('Please choose an image or video.'));
      return;
    }
    if (file.size > MAX_STORY_BYTES) {
      setToast(tr('That file is too large (max 15MB).'));
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setMode('media');
  };

  const post = async () => {
    if (!user) return;
    if (mode === 'text' && !text.trim()) {
      setToast(tr('Write something first, or add a photo/video.'));
      return;
    }
    setPosting(true);

    if (mode === 'media' && mediaFile) {
      const isVideo = mediaFile.type.startsWith('video/');
      const ext = mediaFile.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('story-media')
        .upload(path, mediaFile, { contentType: mediaFile.type });
      if (uploadError) {
        setPosting(false);
        setToast(tr('Upload failed. Try again.'));
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('story-media').getPublicUrl(path);
      const { error: insertError } = await supabase.from('stories').insert({
        author_id: user.id,
        media_url: publicUrlData.publicUrl,
        media_type: isVideo ? 'video' : 'image',
        caption: text.trim() || null,
      });
      setPosting(false);
      if (insertError) { setToast(tr('Failed to post your story.')); return; }
    } else {
      const { error: insertError } = await supabase.from('stories').insert({
        author_id: user.id,
        media_type: 'text',
        caption: text.trim(),
        background_color: background,
      });
      setPosting(false);
      if (insertError) { setToast(tr('Failed to post your story.')); return; }
    }

    history.replace('/tabs/chats');
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div
          style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            background: mode === 'media' && mediaPreview ? '#000' : background,
            transition: 'background 0.2s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 0' }}>
            <IonIcon
              icon={close}
              style={{ fontSize: 28, color: '#fff', cursor: 'pointer' }}
              onClick={() => history.goBack()}
            />
            {mode === 'text' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {BACKGROUNDS.map((bg) => (
                  <div
                    key={bg}
                    onClick={() => setBackground(bg)}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', background: bg, cursor: 'pointer',
                      border: background === bg ? '2px solid #fff' : '2px solid transparent',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {mode === 'media' && mediaPreview ? (
              mediaFile?.type.startsWith('video/') ? (
                <video src={mediaPreview} controls style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 12 }} />
              ) : (
                <img src={mediaPreview} alt={tr('Story preview')} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 12, objectFit: 'contain' }} />
              )
            ) : (
              <IonTextarea
                autoGrow
                placeholder={tr('Type a status...')}
                value={text}
                onIonInput={(e) => setText(e.detail.value ?? '')}
                style={{
                  '--color': '#fff', '--placeholder-color': 'rgba(255,255,255,0.7)',
                  fontSize: 24, fontWeight: 600, textAlign: 'center',
                } as React.CSSProperties}
              />
            )}
          </div>

          {mode === 'media' && (
            <div style={{ padding: '0 16px' }}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={tr('Add a caption...')}
                style={{
                  width: '100%', background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 20,
                  padding: '10px 16px', color: '#fff', fontSize: 14, outline: 'none',
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
            <IonButton fill="clear" onClick={pickMedia} style={{ '--color': '#fff' } as React.CSSProperties}>
              <IonIcon icon={imageOutline} slot="start" />
              {mode === 'media' ? tr('Change') : tr('Photo / Video')}
            </IonButton>
            <IonButton onClick={post} disabled={posting} shape="round">
              {posting ? <IonSpinner name="dots" /> : <IonIcon icon={sendOutline} slot="icon-only" />}
            </IonButton>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelected} style={{ display: 'none' }} />
        </div>

        <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
      </IonContent>
    </IonPage>
  );
};

export default CreateStory;