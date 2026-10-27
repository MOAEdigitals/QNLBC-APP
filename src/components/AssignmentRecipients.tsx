import React, { useEffect, useState } from 'react';
import { fetchDirectoryMembers, type DirectoryMember } from '../services/directory';
export function AssignmentRecipients({ names }: { names: (string | undefined)[] }) {
  const [members, setMembers] = useState<DirectoryMember[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void fetchDirectoryMembers().then(rows => { if (active) setMembers(rows); }).catch(() => { if (active) setError('Notification recipients could not be checked.'); }); return () => { active = false; }; }, []);
  if (!members && !error) return null;
  const unlinked = [...new Set(names.map(name => name?.trim()).filter(name => name && !['tba', 'tbd'].includes(name.toLowerCase())))].filter(name => !(members || []).some(member => member.active && member.linked_user_id && member.account_active && member.name.toLowerCase() === name!.toLowerCase()));
  if (!error && !unlinked.length) return null;
  return <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{error || `No active linked account for: ${unlinked.join(', ')}. Setlist assignment notifications need a linked account. Birthdays, events and custom messages go to active accounts even without a directory link.`}</p>;
}
