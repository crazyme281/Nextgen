/**
 * Save a chat image to the device's actual photo gallery (native), or
 * trigger a normal browser download (web dev/testing).
 *
 * @capacitor-community/media is used rather than a plain <a download> —
 * WebViews generally don't honor the download attribute for cross-origin
 * URLs (Supabase Storage), they just navigate to it instead of saving
 * anything. The two-step write-then-save pattern (Filesystem.writeFile
 * into the cache, then Media.savePhoto from that local path) is the
 * documented way to save data you already have rather than something
 * fresh out of the camera.
 */
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Media } from '@capacitor-community/media';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // FileReader gives a data: URL — strip the "data:...;base64," prefix,
      // Filesystem.writeFile wants the raw base64 payload only.
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function downloadChatImage(url: string, filenameHint = 'image'): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not fetch the image.');
  const blob = await res.blob();

  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  const filename = `nextgen-${filenameHint}-${Date.now()}.${ext}`;

  if (!Capacitor.isNativePlatform()) {
    // Plain browser download — works fine here since it's same-tab, no
    // WebView cross-origin quirk to work around.
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return;
  }

  const base64 = await blobToBase64(blob);
  const written = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });
  await Media.savePhoto({ path: written.uri });
  // Cache is fine to leave — Android periodically reclaims it, and the
  // photo itself now lives in the gallery independent of this file.
}
