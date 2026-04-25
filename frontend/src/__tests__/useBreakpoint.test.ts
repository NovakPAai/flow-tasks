import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBreakpoint, useIsMobile, useIsLandscape, useResponsiveValue } from '../utils/useBreakpoint';

type MqlEntry = { matches: boolean; listeners: Set<(e: Partial<MediaQueryListEvent>) => void> };
type MqlStore = Record<string, MqlEntry>;

function mockMatchMedia(initial: { mobile: boolean; tablet: boolean }) {
  const store: MqlStore = {
    '(max-width: 767px)': { matches: initial.mobile, listeners: new Set() },
    '(max-width: 1023px)': { matches: initial.tablet, listeners: new Set() },
  };

  vi.stubGlobal('matchMedia', vi.fn((query: string) => {
    const entry: MqlEntry = store[query] ?? { matches: false, listeners: new Set() };
    return {
      get matches() { return entry.matches; },
      addEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => entry.listeners.add(fn)),
      removeEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => entry.listeners.delete(fn)),
    };
  }));

  return {
    fire: (query: string, matches: boolean) => {
      store[query].matches = matches;
      store[query].listeners.forEach(fn => fn({ matches }));
    },
  };
}

describe('useBreakpoint', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns "mobile" when width ≤ 767px', () => {
    mockMatchMedia({ mobile: true, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');
  });

  it('returns "tablet" when 768–1023px', () => {
    mockMatchMedia({ mobile: false, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it('returns "desktop" when ≥ 1024px', () => {
    mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('desktop → tablet when crossing 1024px boundary', () => {
    const { fire } = mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');

    act(() => fire('(max-width: 1023px)', true));
    expect(result.current).toBe('tablet');
  });

  it('tablet → desktop when crossing 1024px boundary upward', () => {
    const { fire } = mockMatchMedia({ mobile: false, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');

    act(() => fire('(max-width: 1023px)', false));
    expect(result.current).toBe('desktop');
  });

  it('tablet → mobile when crossing 768px boundary', () => {
    const { fire } = mockMatchMedia({ mobile: false, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');

    act(() => fire('(max-width: 767px)', true));
    expect(result.current).toBe('mobile');
  });

  it('mobile → tablet when crossing 768px boundary upward', () => {
    const { fire } = mockMatchMedia({ mobile: true, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');

    act(() => fire('(max-width: 767px)', false));
    expect(result.current).toBe('tablet');
  });

  it('cleans up both matchMedia listeners on unmount', () => {
    const mqlMobile = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const mqlTablet = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn((q: string) =>
      q.includes('767') ? mqlMobile : mqlTablet
    ));

    const { unmount } = renderHook(() => useBreakpoint());
    unmount();

    expect(mqlMobile.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mqlTablet.removeEventListener).toHaveBeenCalledTimes(1);
  });
});

describe('useIsMobile', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns true only on mobile', () => {
    mockMatchMedia({ mobile: true, tablet: true });
    expect(renderHook(() => useIsMobile()).result.current).toBe(true);
  });

  it('returns false on tablet', () => {
    mockMatchMedia({ mobile: false, tablet: true });
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('returns false on desktop', () => {
    mockMatchMedia({ mobile: false, tablet: false });
    expect(renderHook(() => useIsMobile()).result.current).toBe(false);
  });

  it('updates when breakpoint changes', () => {
    const { fire } = mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => { fire('(max-width: 767px)', true); });
    expect(result.current).toBe(true);
  });
});

describe('useIsLandscape', () => {
  beforeEach(() => vi.unstubAllGlobals());

  function mockOrientationMedia(isLandscape: boolean) {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => {
      const matches = query.includes('landscape') ? isLandscape : false;
      return {
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    }));
  }

  it('returns true when in landscape with small height', () => {
    mockOrientationMedia(true);
    const { result } = renderHook(() => useIsLandscape());
    expect(result.current).toBe(true);
  });

  it('returns false when in portrait', () => {
    mockOrientationMedia(false);
    const { result } = renderHook(() => useIsLandscape());
    expect(result.current).toBe(false);
  });
});

describe('useResponsiveValue', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns mobile value on mobile', () => {
    mockMatchMedia({ mobile: true, tablet: true });
    const { result } = renderHook(() => useResponsiveValue('sm', 'md', 'lg'));
    expect(result.current).toBe('sm');
  });

  it('returns tablet value on tablet', () => {
    mockMatchMedia({ mobile: false, tablet: true });
    const { result } = renderHook(() => useResponsiveValue('sm', 'md', 'lg'));
    expect(result.current).toBe('md');
  });

  it('returns desktop value on desktop', () => {
    mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useResponsiveValue('sm', 'md', 'lg'));
    expect(result.current).toBe('lg');
  });

  it('updates when breakpoint changes', () => {
    const { fire } = mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useResponsiveValue(16, 40, 80));
    expect(result.current).toBe(80);

    act(() => fire('(max-width: 1023px)', true));
    expect(result.current).toBe(40);

    act(() => fire('(max-width: 767px)', true));
    expect(result.current).toBe(16);
  });
});
