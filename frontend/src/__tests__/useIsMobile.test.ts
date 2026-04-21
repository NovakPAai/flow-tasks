import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useIsMobile } from '../utils/useIsMobile';

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(e: Partial<MediaQueryListEvent>) => void>();
  const mql = {
    matches,
    addEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => listeners.add(fn)),
    removeEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => listeners.delete(fn)),
    dispatchChange: (newMatches: boolean) => {
      listeners.forEach(fn => fn({ matches: newMatches }));
    },
  };
  const impl = vi.fn().mockReturnValue(mql);
  vi.stubGlobal('matchMedia', impl);
  return { mql, impl };
}

describe('useIsMobile', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when viewport matches mobile query', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(true);
  });

  it('returns false when viewport does not match mobile query', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(false);
  });

  it('updates to true when matchMedia fires a change event', () => {
    const { mql } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile(768));
    expect(result.current).toBe(false);

    act(() => mql.dispatchChange(true));
    expect(result.current).toBe(true);
  });

  it('updates back to false when matchMedia fires another change event', () => {
    const { mql } = mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile(768));

    act(() => mql.dispatchChange(false));
    expect(result.current).toBe(false);
  });

  it('removes the event listener on unmount', () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile(768));
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('builds the correct media query string for the default breakpoint', () => {
    const { impl } = mockMatchMedia(false);
    renderHook(() => useIsMobile());
    expect(impl).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('builds the correct media query string for a custom breakpoint', () => {
    const { impl } = mockMatchMedia(true);
    renderHook(() => useIsMobile(480));
    expect(impl).toHaveBeenCalledWith('(max-width: 479px)');
  });

  it('re-registers the listener when breakpoint changes', () => {
    const { mql } = mockMatchMedia(false);
    const { rerender } = renderHook(({ bp }: { bp: number }) => useIsMobile(bp), {
      initialProps: { bp: 768 },
    });
    rerender({ bp: 480 });
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mql.addEventListener).toHaveBeenCalledTimes(2);
  });
});
