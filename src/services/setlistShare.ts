import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Filesystem } from '@capacitor/filesystem';

export function canShareSetlistImage(title: string, url: string, image: File): boolean {
  return Capacitor.isNativePlatform() || Boolean(navigator.canShare?.({ title, text: title, url, files: [image] }));
}

/** A photo attachment intentionally contains no clickable app URL or caption URL. */
export async function shareSetlistPhoto(title: string, image: File): Promise<'shared' | 'cancelled' | 'unsupported'> {
  try {
    if (Capacitor.isNativePlatform()) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('The setlist image could not be read.'));
        reader.readAsDataURL(image);
      });
      const file = await Filesystem.writeFile({ path: `shared/${image.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`, data: base64, directory: Directory.Cache, recursive: true });
      await Share.share({ title, files: [file.uri], dialogTitle: 'Share setlist photo' });
    } else {
      if (!navigator.share || !navigator.canShare?.({ files: [image] })) return 'unsupported';
      await navigator.share({ title, files: [image] });
    }
    return 'shared';
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Share canceled')) return 'cancelled';
    throw error;
  }
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
