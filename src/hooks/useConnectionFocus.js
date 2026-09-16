import { useEffect, useMemo, useState } from 'react';
import { connectionPress, toggleConnectionRoot } from '../utils/connectionFocus';

export function useConnectionFocus() {
  const [locked, setLocked] = useState(new Set());
  const press = useMemo(() => connectionPress((id, additive) => {
    setLocked(previous => toggleConnectionRoot(previous, id, additive));
  }), []);

  useEffect(() => {
    window.addEventListener('pointermove', press.move, true);
    window.addEventListener('pointerup', press.end, true);
    window.addEventListener('pointercancel', press.cancel, true);
    window.addEventListener('blur', press.cancel);
    document.addEventListener('visibilitychange', press.cancel);
    return () => {
      press.cancel();
      window.removeEventListener('pointermove', press.move, true);
      window.removeEventListener('pointerup', press.end, true);
      window.removeEventListener('pointercancel', press.cancel, true);
      window.removeEventListener('blur', press.cancel);
      document.removeEventListener('visibilitychange', press.cancel);
    };
  }, [press]);

  return { locked, setLocked, press };
}
