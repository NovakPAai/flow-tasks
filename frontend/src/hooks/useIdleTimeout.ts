import { useEffect, useRef, useCallback } from 'react';

const IDLE_MS = 30 * 60 * 1000;   // 30 minutes
const WARN_BEFORE_MS = 60 * 1000; // warn 60 s before logout

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'scroll', 'touchstart', 'click',
] as const;

export interface IdleTimeoutOptions {
  /** Called 60 s (warnBeforeMs) before the idle deadline. */
  onWarn?: () => void;
  /** Called when user activity resets the timers (not on initial mount). */
  onActivityReset?: () => void;
  idleMs?: number;
  warnBeforeMs?: number;
}

/**
 * Fires options.onWarn 60 s before logout, then onIdle at the deadline.
 * Returns a manual reset() for "Stay logged in" buttons.
 * - Any user activity restarts both timers and calls onActivityReset.
 * - Timers pause while the tab is hidden; resume (and reset) on visibility.
 */
export function useIdleTimeout(
  onIdle: () => void,
  options: IdleTimeoutOptions = {},
): () => void {
  const { onWarn, onActivityReset, idleMs = IDLE_MS, warnBeforeMs = WARN_BEFORE_MS } = options;

  const onIdleRef = useRef(onIdle);
  const onWarnRef = useRef(onWarn);
  const onActivityResetRef = useRef(onActivityReset);
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);
  useEffect(() => { onWarnRef.current = onWarn; }, [onWarn]);
  useEffect(() => { onActivityResetRef.current = onActivityReset; }, [onActivityReset]);

  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let warnTimer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(idleTimer);
      clearTimeout(warnTimer);
      if (onWarnRef.current && warnBeforeMs < idleMs) {
        warnTimer = setTimeout(() => onWarnRef.current?.(), idleMs - warnBeforeMs);
      }
      idleTimer = setTimeout(() => onIdleRef.current(), idleMs);
    };

    const handleActivity = () => {
      onActivityResetRef.current?.();
      schedule();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimeout(idleTimer);
        clearTimeout(warnTimer);
      } else {
        onActivityResetRef.current?.();
        schedule();
      }
    };

    resetRef.current = schedule;

    schedule(); // initial setup — does NOT call onActivityReset

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(warnTimer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [idleMs, warnBeforeMs]);

  return useCallback(() => resetRef.current(), []);
}
