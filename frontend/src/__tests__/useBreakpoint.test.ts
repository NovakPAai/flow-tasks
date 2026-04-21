import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBreakpoint, useIsMobile } from '../utils/useBreakpoint';

type MqlStore = Record<string, { matches: boolean; listeners: Set<(e: Partial<MediaQueryListEvent>) => void> }>;

function mockMatchMedia(initial: { mobile: boolean; tablet: boolean }) {
  const store: MqlStore = {
    '(max-width: 767px)': { matches: initial.mobile, listeners: new Set() },
    '(max-width: 1023px)': { matches: initial.tablet, listeners: new Set() },
  };

  const impl = vi.fn((query: string) => {
    const entry = store[query] ?? { matches: false, listeners: new Set() };
    return {
      get matches() { return entry.matches; },
      addEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => entry.listeners.add(fn)),
      removeEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => entry.listeners.delete(fn)),
    };
  });

  vi.stubGlobal('matchMedia', impl);

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

  it('returns "tablet" when 768px ≤ width ≤ 1023px', () => {
    mockMatchMedia({ mobile: false, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it('returns "desktop" when width ≥ 1024px', () => {
    mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('transitions desktop → tablet when crossing 1024px boundary', () => {
    const { fire } = mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');

    act(() => fire('(max-width: 1023px)', true));
    expect(result.current).toBe('tablet');
  });

  it('transitions tablet → mobile when crossing 768px boundary', () => {
    const { fire } = mockMatchMedia({ mobile: false, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');

    act(() => fire('(max-width: 767px)', true));
    expect(result.current).toBe('mobile');
  });

  it('transitions mobile → tablet when crossing 768px upward', () => {
    const { fire } = mockMatchMedia({ mobile: true, tablet: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('mobile');

    act(() => { fire('(max-width: 767px)', false); });
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

describe('useIsMobile (re-export)', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('returns true only on mobile breakpoint', () => {
    mockMatchMedia({ mobile: true, tablet: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false on tablet', () => {
    mockMatchMedia({ mobile: false, tablet: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns false on desktop', () => {
    mockMatchMedia({ mobile: false, tablet: false });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
