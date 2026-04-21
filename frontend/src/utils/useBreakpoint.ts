import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_MAX = 767;   // ≤767px
const TABLET_MAX = 1023;  // 768–1023px

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches) return 'mobile';
  if (window.matchMedia(`(max-width: ${TABLET_MAX}px)`).matches) return 'tablet';
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(getBreakpoint);
  useEffect(() => {
    const mobile = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const tablet = window.matchMedia(`(max-width: ${TABLET_MAX}px)`);
    const update = () => setBp(getBreakpoint());
    mobile.addEventListener('change', update);
    tablet.addEventListener('change', update);
    return () => {
      mobile.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
    };
  }, []);
  return bp;
}

export const useIsMobile = (): boolean => useBreakpoint() === 'mobile';
