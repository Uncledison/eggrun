/**
 * GA4 event helper for 에그런.
 *
 * The gtag.js loader and its `gtag('config', …)` bootstrap live in the root
 * route's `head.scripts` (see `src/routes/__root.tsx`). This module only sends
 * events, and it stays silent whenever gtag is not there yet — server render,
 * offline, or a browser that blocked the script — so analytics can never throw
 * into the game loop.
 */

export type TrackParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Parameters with empty values dropped, so GA4 never gets `{ reason: undefined }`. */
function cleanParams(params: TrackParams): TrackParams {
  const out: TrackParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Send one GA4 event. Safe to call from anywhere: it returns quietly on the
 * server, before the gtag script has loaded, and if the call itself throws.
 */
export function trackEvent(name: string, params: TrackParams = {}): void {
  if (typeof window === "undefined") return;
  const gtag = window.gtag;
  if (typeof gtag !== "function") return;
  try {
    gtag("event", name, cleanParams(params));
  } catch {
    /* a blocked or half-loaded analytics script must not break the game */
  }
}
