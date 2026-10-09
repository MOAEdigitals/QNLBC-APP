import { supabase } from '../supabase';
import { getAudioFromStorage } from '../utils/audioStorage';

// Preserve database IDs and relationships, including records in tabs never opened.
export const BACKUP_TABLES = ['profiles', 'songs', 'setlists', 'setlist_items',
  'special_numbers', 'choir_entries', 'practice_entries', 'vocal_parts',
  'vocal_part_assignments', 'media', 'attachments', 'birthdays', 'anniversaries',
  'visitors', 'recognitions', 'app_settings', 'church_activities', 'sermon_outlines'] as const;

async function readTable(table: string): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select('*')
      .order(table === 'app_settings' ? 'key' : 'id').range(offset, offset + 499);
    if (error) throw new Error(`Backup stopped at ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read backup attachment.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function createFullBackup(progress: (message: string) => void) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Please sign in again.');
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role, active').eq('id', auth.user.id).single();
  if (profileError || !profile?.active || profile.role !== 'admin') throw new Error('Administrator access required.');
  const startedAt = new Date().toISOString();
  const tables: Record<string, Record<string, any>[]> = {};
  for (const table of BACKUP_TABLES) {
    progress(`Backing up ${table.replaceAll('_', ' ')}…`);
    tables[table] = await readTable(table);
  }
  const assets: Record<string, string> = {};
  const externalLinks = new Set<string>();
  const references = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === 'string') {
      if (/^(firestore:media:|indexeddb:)/.test(value) || value.startsWith('https://pub-aaa45e93104541548f563b3496acae00.r2.dev/')) references.add(value);
      else if (/^https?:\/\//.test(value)) externalLinks.add(value);
    } else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(tables);
  for (const reference of references) {
    progress(`Backing up recording ${Object.keys(assets).length + 1}…`);
    let data: string | null;
    if (reference.startsWith('https:')) {
      const response = await fetch(reference, { signal: AbortSignal.timeout(180000) });
      if (!response.ok) throw new Error('Recording download failed. Backup was not completed.');
      data = await asDataUrl(await response.blob());
    } else {
      if (reference.startsWith('firestore:')) throw new Error('An unmigrated recording remains. Complete recording migration before exporting.');
      data = await getAudioFromStorage(reference.replace(/^indexeddb:/, ''));
    }
    if (!data?.startsWith('data:')) throw new Error(`Recording unavailable: ${reference}. Backup was not completed.`);
    assets[reference] = data;
  }
  for (const sermon of tables.sermon_outlines) {
    for (const file of sermon.attachments || []) {
      const reference = `storage:sermon-files:${file.path}`;
      if (assets[reference]) continue;
      progress(`Backing up ${file.name || 'outline attachment'}…`);
      const { data, error } = await supabase.storage.from('sermon-files').download(file.path);
      if (error || !data) throw new Error(`Attachment unavailable: ${file.name || file.path}`);
      assets[reference] = await asDataUrl(data);
    }
  }
  // Detect changes during the export instead of silently exporting mixed revisions.
  for (const table of BACKUP_TABLES) {
    progress('Verifying backup…');
    if (JSON.stringify(await readTable(table)) !== JSON.stringify(tables[table])) {
      throw new Error('Church data changed during backup. Please export again when editing has finished.');
    }
  }
  return { format: 'qnlbc-database-archive', version: 1, startedAt,
    exportedAt: new Date().toISOString(), tables, assets,
    externalLinks: [...externalLinks],
    scope: 'Database records and referenced R2 recordings/legacy recordings/sermon files. External links are preserved as links. Auth passwords and provider configuration are excluded.' };
}
