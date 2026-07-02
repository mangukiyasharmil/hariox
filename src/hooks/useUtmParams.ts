/**
 * UTM Parameter & Meta Click ID Persistence
 * 
 * Captures UTM params + fbclid from URL on first visit and stores them
 * in sessionStorage so they persist across SPA navigations.
 * Also manually creates the _fbc cookie if Meta Pixel hasn't set it yet,
 * ensuring purchase attribution works even with parameterized campaign links.
 */

const UTM_STORAGE_KEY = "utm_params";

export interface UtmParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/**
 * Manually create the _fbc cookie from fbclid URL parameter.
 * Format: fb.1.{timestamp_ms}.{fbclid}
 * Meta Pixel normally does this, but on SPAs with UTM params it can fail.
 */
const ensureFbcCookie = (): void => {
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (!fbclid) return;

    // Check if _fbc cookie already exists
    const existingFbc = document.cookie.match(/(^| )_fbc=([^;]+)/);
    if (existingFbc) return; // Pixel already set it, no action needed

    // Create _fbc cookie in Meta's expected format
    const fbcValue = `fb.1.${Date.now()}.${fbclid}`;
    const domain = window.location.hostname.replace(/^www\./, "");
    // Set cookie for 90 days (Meta standard), accessible on all subdomains
    document.cookie = `_fbc=${fbcValue}; max-age=${90 * 24 * 60 * 60}; path=/; domain=.${domain}; SameSite=Lax`;
    console.log("[UTM] Manually set _fbc cookie from fbclid");
  } catch (e) {
    // Silently ignore cookie errors
  }
};

/** Call once on app mount to capture UTM params from the landing URL */
export const captureUtmParams = (): void => {
  const params = new URLSearchParams(window.location.search);
  const utm_source = params.get("utm_source");
  const utm_medium = params.get("utm_medium");
  const utm_campaign = params.get("utm_campaign");

  // Only overwrite if at least one UTM param is present in current URL
  if (utm_source || utm_medium || utm_campaign) {
    const utmData: UtmParams = { utm_source, utm_medium, utm_campaign };
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmData));
  }

  // Ensure Meta _fbc cookie is set from fbclid (fixes parameterized link attribution)
  ensureFbcCookie();
};

/** Retrieve stored UTM params (returns nulls if none captured) */
export const getStoredUtmParams = (): UtmParams => {
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore parse errors
  }
  return { utm_source: null, utm_medium: null, utm_campaign: null };
};
