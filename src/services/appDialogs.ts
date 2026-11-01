export interface AppDialogRequest { id: number; message: string; choice: boolean }
let sequence = 0;
const queue: { request: AppDialogRequest; resolve: (value: boolean) => void }[] = [];
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach(fn => fn());
export const subscribeAppDialogs = (listener: () => void) => { subscribers.add(listener); return () => { subscribers.delete(listener); }; };
export const currentAppDialog = () => queue[0]?.request || null;
const request = (message: unknown, choice: boolean): Promise<boolean> => new Promise(resolve => { queue.push({ request: { id: ++sequence, message: String(message), choice }, resolve }); emit(); });
export const confirmAction = (message: unknown) => queue.some(item => item.request.choice && item.request.message === String(message)) ? Promise.resolve(false) : request(message, true);
export const showAppMessage = (message: unknown) => request(message, false).then(() => undefined);
export function resolveAppDialog(id: number, accepted: boolean) {
  if (queue[0]?.request.id !== id) return;
  const current = queue.shift()!; emit(); current.resolve(accepted);
}
