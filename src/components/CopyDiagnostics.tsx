import React, { useState } from 'react';
import { CopyIcon } from './AnimatedIcons';
import { collectDiagnostics } from '../services/diagnostics';
import { copyWithFeedback } from '../services/clipboard';

export function CopyDiagnostics() {
  const [busy, setBusy] = useState(false);
  return <button type="button" className="ui-secondary" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await copyWithFeedback(await collectDiagnostics(), 'Diagnostics copied.'); }
    finally { setBusy(false); }
  }}><CopyIcon className="h-4 w-4" />Copy diagnostics</button>;
}
