import { useEffect, useRef } from 'react';

const IDLE_MS = 5 * 60 * 1000; // 5 minutes

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'scroll', 'touchstart', 'click',
] as const;

/**
 * Calls onIdle after idleMs of no user activity.
 * Timer resets on mousemove, mousedown, keydown, scroll, touchstart, click.
 */
export function useIdleTimeout(onIdle: () => void, idleMs = IDLE_MS) {
  // Keep a stable ref so the timer doesn't restart when the callback identity changes.
  const onIdleRef = useRef(onIdle);
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), idleMs);
    };

    reset();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, reset, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, reset);
      }
    };
  }, [idleMs]);
}
