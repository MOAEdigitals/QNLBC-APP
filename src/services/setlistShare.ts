import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';

export function canShareSetlistImage(title: string, url: string, image: File): boolean {
  return Capacitor.isNativePlatform() || Boolean(navigator.canShare?.({ title, text: title, url, files: [image] }));
}

export async function shareSetlistContent(title: string, url: string, image?: File): Promise<'shared' | 'cancelled' | 'unsupported'> {
  try {
    if (Capacitor.isNativePlatform()) {
      if (image) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('The setlist image could not be read.'));
          reader.readAsDataURL(image);
        });
        const name = image.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const file = await Filesystem.writeFile({ path: `shared/${name}`, data: base64, directory: Directory.Cache, recursive: true });
        await Share.share({ title, text: `${title}\n${url}`, files: [file.uri], dialogTitle: 'Share setlist' });
      } else await Share.share({ title, text: title, url, dialogTitle: 'Share setlist' });
      return 'shared';
    }
    if (!navigator.share) return 'unsupported';
    const data: ShareData = { title, text: title, url };
    if (image && canShareSetlistImage(title, url, image)) data.files = [image];
    await navigator.share(data);
    return 'shared';
  }
  catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Share canceled')) return 'cancelled';
    throw error;
  }
}
