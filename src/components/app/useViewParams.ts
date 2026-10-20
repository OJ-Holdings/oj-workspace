'use client';

import { useSearchParams } from 'next/navigation';

/** Keep work views shareable and preserve unrelated record deep links. */
export function useViewParams() {
  const params = useSearchParams();
  function update(values: Record<string, string>, push = false) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history[push ? 'pushState' : 'replaceState'](null, '', `${url.pathname}${url.search}${url.hash}`);
  }
  return { params, update };
}
