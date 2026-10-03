import { supabase } from '../../supabase';
import { generateUUID } from '../../services/supabaseData';
import type { SermonAttachment } from './model';
export const SERMON_BUCKET = 'sermon-files';
export const MAX_SERMON_FILE_BYTES = 20 * 1024 * 1024;
export async function validateSermonFile(file: File): Promise<'pdf' | 'docx'> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'pdf' && extension !== 'docx') throw new Error('Choose a PDF or DOCX file.');
  if (file.size === 0 || file.size > MAX_SERMON_FILE_BYTES) throw new Error('Attachments must be between 1 byte and 20 MB.');
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (extension === 'pdf' && String.fromCharCode(...signature) !== '%PDF-') throw new Error('This file is not a valid PDF.');
  if (extension === 'docx' && (signature[0] !== 80 || signature[1] !== 75)) throw new Error('This file is not a valid DOCX.');
  return extension;
}
export async function uploadSermonFile(file: File, authorId: string, sermonId: string): Promise<SermonAttachment> {
  const kind = await validateSermonFile(file);
  const id = generateUUID();
  const path = `${authorId}/${sermonId}/${id}.${kind}`;
  const contentType = kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const { error } = await supabase.storage.from(SERMON_BUCKET).upload(path, file, { contentType, upsert: false });
  if (error) throw new Error(`Attachment upload failed: ${error.message}. Check that the sermon files setup SQL has been run.`);
  return { id, name: file.name, kind, path, size: file.size };
}
export async function downloadSermonFile(attachment: SermonAttachment): Promise<Blob> {
  const { data, error } = await supabase.storage.from(SERMON_BUCKET).download(attachment.path);
  if (error || !data) throw new Error(error?.message || 'Unable to load this attachment.');
  return data;
}
export async function removeUnusedSermonFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  // Database policies refuse to remove any object still attached to a saved sermon.
  await supabase.storage.from(SERMON_BUCKET).remove(paths).catch(() => {});
}
