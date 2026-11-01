import React, { useSyncExternalStore } from 'react';
import { BottomSheet } from './BottomSheet';
import { currentAppDialog, resolveAppDialog, subscribeAppDialogs } from '../services/appDialogs';
export function AppDialogHost() {
  const request = useSyncExternalStore(subscribeAppDialogs, currentAppDialog, () => null);
  if (!request) return null;
  const destructive = /delete|remove|cannot be undone/i.test(request.message);
  return <BottomSheet key={request.id} open title={request.choice ? destructive ? 'Confirm deletion' : 'Confirm action' : 'Notice'} role="alertdialog" onClose={() => resolveAppDialog(request.id, false)}>
    <p className="px-1 py-3 whitespace-pre-wrap break-words">{request.message}</p>
    <div className="ui-sheet-actions">
      {request.choice && <button type="button" data-sheet-focus className="ui-secondary" onClick={() => resolveAppDialog(request.id, false)}>Cancel</button>}
      <button type="button" className={request.choice && destructive ? 'ui-danger' : 'ui-primary'} onClick={() => resolveAppDialog(request.id, true)}>{request.choice ? destructive ? 'Delete' : 'Continue' : 'OK'}</button>
    </div>
  </BottomSheet>;
}
