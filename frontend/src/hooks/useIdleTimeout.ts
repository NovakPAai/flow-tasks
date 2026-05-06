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
 * - Uses wall-clock deadlines: hiding the tab pauses setTimeout, but on
 *   tab show we check the absolute deadline and fire immediately if passed.
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
    let deadline = 0;

    const scheduleFromDeadline = (d: number) => {
      clearTimeout(idleTimer);
      clearTimeout(warnTimer);
      deadline = d;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        onIdleRef.current();
        return;
      }
      if (onWarnRef.current && warnBeforeMs < idleMs) {
        const warnIn = remaining - warnBeforeMs;
        if (warnIn > 0) {
          warnTimer = setTimeout(() => onWarnRef.current?.(), warnIn);
        } else {
          onWarnRef.current?.();
        }
      }
      idleTimer = setTimeout(() => onIdleRef.current(), remaining);
    };

    const schedule = () => scheduleFromDeadline(Date.now() + idleMs);

    const handleActivity = () => {
      onActivityResetRef.current?.();
      schedule();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        // Pause timers while hidden; wall-clock deadline is preserved in `deadline`
        clearTimeout(idleTimer);
        clearTimeout(warnTimer);
      } else {
        // Resume from the stored deadline — fires immediately if already past
        scheduleFromDeadline(deadline);
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
