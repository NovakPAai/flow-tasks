import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_QUERY = '(max-width: 767px)';
const TABLET_QUERY = '(max-width: 1023px)';

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(MOBILE_QUERY).matches) return 'mobile';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(getBreakpoint);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mobile = window.matchMedia(MOBILE_QUERY);
    const tablet = window.matchMedia(TABLET_QUERY);
    // Derive breakpoint from the stable mql references — avoids allocating
    // throwaway MQL objects on every change event.
    const update = () => {
      if (mobile.matches) setBp('mobile');
      else if (tablet.matches) setBp('tablet');
      else setBp('desktop');
    };
    mobile.addEventListener('change', update);
    tablet.addEventListener('change', update);
    return () => {
      mobile.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
    };
  }, []);
  return bp;
}

export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile';
}

// Landscape на мобильном/планшете: ширина > высоты И не desktop
const LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 600px)';

export function useIsLandscape(): boolean {
  const [landscape, setLandscape] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(LANDSCAPE_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(LANDSCAPE_QUERY);
    const update = (e: MediaQueryListEvent) => setLandscape(e.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return landscape;
}

export function useResponsiveValue<T>(mobile: T, tablet: T, desktop: T): T {
  const bp = useBreakpoint();
  if (bp === 'mobile') return mobile;
  if (bp === 'tablet') return tablet;
  return desktop;
}
