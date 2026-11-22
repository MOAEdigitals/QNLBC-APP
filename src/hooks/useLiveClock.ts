import { useEffect, useState } from 'react';

export function useLiveClock() {
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    const update = () => setClock(Date.now());
    const timer = window.setInterval(update, 15000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return clock;
}
