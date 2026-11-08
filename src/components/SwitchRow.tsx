import React from 'react';

/** The full labeled row is a keyboard/touch target; color is not the only state cue. */
export function SwitchRow({ label, checked, disabled = false, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void;
}) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled}
    className="ui-switch-row" onClick={() => onChange(!checked)}>
    <span className="min-w-0 break-words">{label}</span>
    <span className="ui-switch-track" aria-hidden="true"><span className="ui-switch-thumb" /></span>
  </button>;
}
