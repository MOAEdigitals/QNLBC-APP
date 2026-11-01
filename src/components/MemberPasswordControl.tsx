import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function MemberPasswordControl({ name, password, visible, disabled, onToggle, onUnavailable }: {
  name: string; password?: string; visible: boolean; disabled: boolean;
  onToggle: () => void; onUnavailable: () => void;
}) {
  const revealed = !!password && visible;
  return <div className="member-password-control">
    <span className="member-password-value" aria-live="polite" aria-label={revealed ? `Password for ${name}` : `Password hidden for ${name}`}>{revealed ? password : '••••••••'}</span>
    <button type="button" disabled={disabled} aria-label={`${revealed ? 'Hide' : 'Show'} password for ${name}`} title={password ? 'Show or hide password' : 'Password is protected; click for details'} onClick={password ? onToggle : onUnavailable}>
      {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>;
}
