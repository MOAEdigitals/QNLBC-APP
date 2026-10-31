import { PUBLIC_APP_URL } from './setlistSharing.ts';

export function formatAccountCredentials(name: string, username: string, password: string): string {
  if (!username.trim() || !password) throw new Error('Set a password before copying complete credentials.');
  return [`Webapp: ${PUBLIC_APP_URL}`, `Name: ${name || username}`, `Username: ${username}`, `Password: ${password}`].join('\n');
}
