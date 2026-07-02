import { useEffect, useRef } from "react";

interface MetaPixelProps {
  pixelId?: string | null;
}

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
    _fbq_initialized_pixels?: Set<string>;
  }
}

// ─── Runtime pixel storage (populated from DB via company record) ───
let _runtimePixelId: string | null = null;
let _runtimeCompanyPixels: Record<string, string> = {};

/** Set the active pixel from the company's meta_pixel_id in the database */
export const setRuntimePixelId = (pixelId: string | null) => {
  if (pixelId) _runtimePixelId = pixelId;
};

/** Register a company slug → pixel mapping (for cross-domain payment redirects) */
export const registerCompanyPixel = (slug: string, pixelId: string) => {
  if (slug && pixelId) _runtimeCompanyPixels[slug] = pixelId;
};

/** Returns the pixel that should fire, sourced from the database company record */
const getActivePixelId = (): string | null => {
  const h = window.location.hostname.toLowerCase();

  // Never fire on dev / preview / localhost
  if (
    h.includes('lovableproject.com') ||
    h.includes('lovable.app') ||
    h === 'localhost' ||
    h === '127.0.0.1'
  ) {
    return null;
  }

  // Use the pixel set from the database
  return _runtimePixelId;
};

/**
 * MetaPixel component — initialises the pixel from the company's database record.
 * Pass the company's meta_pixel_id as the pixelId prop.
 */
const MetaPixel = ({ pixelId: propPixelId }: MetaPixelProps) => {
  const noscriptRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store runtime pixel from prop (database value)
    if (propPixelId) setRuntimePixelId(propPixelId);

    const pixelId = propPixelId || getActivePixelId();
    if (!pixelId) return;

    // Track which pixels have been initialized
    if (!window._fbq_initialized_pixels) {
      window._fbq_initialized_pixels = new Set();
    }

    // Skip if this specific pixel is already initialized
    if (window._fbq_initialized_pixels.has(pixelId)) return;

    // Initialize fbq function if not yet loaded
    if (!window.fbq) {
      const n: any = window.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!window._fbq) window._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];

      // Load pixel script once
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript?.parentNode?.insertBefore(script, firstScript);
    }

    // Init this specific pixel with Advanced Matching if user data available
    const advancedMatchData: Record<string, string> = {};
    // Try to get user data from sessionStorage (set during form submission)
    try {
      const storedEmail = sessionStorage.getItem('meta_am_email');
      const storedPhone = sessionStorage.getItem('meta_am_phone');
      if (storedEmail) advancedMatchData.em = storedEmail;
      if (storedPhone) advancedMatchData.ph = storedPhone.startsWith('91') ? storedPhone : `91${storedPhone}`;
    } catch {}

    if (Object.keys(advancedMatchData).length > 0) {
      window.fbq('init', pixelId, advancedMatchData);
      console.log(`[MetaPixel] Initialized pixel ${pixelId} with Advanced Matching`);
    } else {
      window.fbq('init', pixelId);
    }
    // Use trackSingle to prevent PageView firing on ALL initialized pixels (cross-company leaking)
    window.fbq('trackSingle', pixelId, 'PageView');
    window._fbq_initialized_pixels.add(pixelId);
    console.log(`[MetaPixel] Initialized pixel ${pixelId} on ${window.location.hostname}`);

    // Create noscript fallback
    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    document.body.appendChild(noscript);
    noscriptRef.current = noscript;

    return () => {
      if (noscriptRef.current?.parentNode) {
        noscriptRef.current.parentNode.removeChild(noscriptRef.current);
      }
    };
  }, []);

  return null;
};

export default MetaPixel;

// ─── Event helpers (company-isolated pixel tracking) ───

/** Get pixel ID by company slug (for cross-domain payment redirects) */
export const getPixelIdForCompany = (company: string): string | null => {
  return _runtimeCompanyPixels[company] || null;
};

/** Ensure a specific pixel is initialized (for override scenarios) */
const ensurePixelInitialized = (pixelId: string) => {
  if (!window._fbq_initialized_pixels) {
    window._fbq_initialized_pixels = new Set();
  }
  
  // Initialize fbq function if not yet loaded
  if (!window.fbq) {
    const n: any = window.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
  }

  if (!window._fbq_initialized_pixels.has(pixelId)) {
    window.fbq('init', pixelId);
    window._fbq_initialized_pixels.add(pixelId);
    console.log(`[MetaPixel] Late-initialized pixel ${pixelId} for override tracking`);
  }
};

/** Get/set test event code for Meta Events Manager testing */
let _testEventCode: string | null = null;
export const setTestEventCode = (code: string | null) => { _testEventCode = code; };
export const getTestEventCode = () => _testEventCode;

/** Track a custom event — uses trackSingle to prevent cross-pixel leaking */
export const trackEvent = (eventName: string, params?: object, overridePixelId?: string, eventId?: string) => {
  const pixelId = overridePixelId || getActivePixelId();

  if (overridePixelId) {
    ensurePixelInitialized(overridePixelId);
  }

  // Merge test_event_code if set (for Meta Events Manager Test Events tab)
  const finalParams = _testEventCode
    ? { ...params, test_event_code: _testEventCode }
    : params;

  const fireFbq = () => {
    if (!window.fbq || !pixelId) return false;
    try {
      // Pass eventID as 4th argument for proper attribution & deduplication
      // This is CRITICAL for Ads Manager to link Purchase events to ad clicks
      if (eventId) {
        window.fbq('track', eventName, finalParams || {}, { eventID: eventId });
      } else {
        window.fbq('track', eventName, finalParams || {});
      }
      console.log(`[MetaPixel] fbq('track', '${eventName}') fired on pixel ${pixelId}`, finalParams, eventId ? `eventID=${eventId}` : '');

      // Also fire sendBeacon image pixel as bulletproof fallback for key events
      if (pixelId && (eventName === 'Lead' || eventName === 'Purchase')) {
        try {
          const cd = finalParams ? Object.entries(finalParams as Record<string, any>)
            .map(([k, v]) => `cd[${encodeURIComponent(k)}]=${encodeURIComponent(String(v))}`)
            .join('&') : '';
          const eidParam = eventId ? `&eid=${encodeURIComponent(eventId)}` : '';
          const url = `https://www.facebook.com/tr?id=${pixelId}&ev=${eventName}&${cd}${eidParam}&noscript=1`;
          if (navigator.sendBeacon) {
            navigator.sendBeacon(url);
          } else {
            const img = new Image(1, 1);
            img.src = url;
          }
          console.log(`[MetaPixel] Fallback beacon for ${eventName} fired`, eventId || '');
        } catch (beaconErr) {
          console.warn('[MetaPixel] Beacon fallback error:', beaconErr);
        }
      }

      return true;
    } catch (e) {
      console.error('[MetaPixel] fbq error:', e);
      return false;
    }
  };

  if (fireFbq()) return;

  // Retry up to 10 times (5 seconds)
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (fireFbq()) {
      clearInterval(interval);
    } else if (attempts >= 10) {
      clearInterval(interval);
      console.warn('[MetaPixel] fbq not loaded after 5s, could not track:', eventName);
    }
  }, 500);
};

/** Fire a Purchase event via sendBeacon (bulletproof fallback for navigation scenarios) */
export const fireImagePixelPurchase = (amount: number, orderId: string, overridePixelId?: string) => {
  const pixelId = overridePixelId || getActivePixelId();
  if (!pixelId) return;

  // Use orderId as dedup key — Meta ignores duplicate events with same eid
  const eventId = `purchase_${orderId}`;

  try {
    // Single method: sendBeacon (most reliable, survives page navigation)
    if (navigator.sendBeacon) {
      const beaconUrl = `https://www.facebook.com/tr?id=${pixelId}&ev=Purchase&cd[value]=${amount}&cd[currency]=INR&cd[order_id]=${orderId}&eid=${eventId}&noscript=1`;
      navigator.sendBeacon(beaconUrl);
      console.log(`[MetaPixel] sendBeacon Purchase fired: ₹${amount} order ${orderId} pixel ${pixelId} eid=${eventId}`);
    } else {
      // Fallback: image pixel only if sendBeacon unavailable
      const img = new Image(1, 1);
      img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=Purchase&cd[value]=${amount}&cd[currency]=INR&cd[order_id]=${orderId}&eid=${eventId}&noscript=1`;
      document.body?.appendChild(img);
      console.log(`[MetaPixel] Image pixel Purchase fired: ₹${amount} order ${orderId} pixel ${pixelId} eid=${eventId}`);
    }
  } catch (e) {
    console.error('[MetaPixel] Image pixel error:', e);
  }
};

// Common event helpers — deduplicated by leadId
export const trackLead = (params?: { content_name?: string; value?: number }, leadId?: string) => {
  const eventId = leadId ? `lead_${leadId}` : undefined;
  trackEvent('Lead', params, undefined, eventId);
};

export const trackSubmitApplication = (loanType: string, amount: number) => {
  trackEvent('SubmitApplication', {
    content_name: loanType,
    value: amount,
    currency: 'INR'
  });
};

export const trackCompleteRegistration = (method: string) => {
  trackEvent('CompleteRegistration', { method });
};

export const trackInitiateCheckout = (amount: number) => {
  trackEvent('InitiateCheckout', {
    value: amount,
    currency: 'INR'
  });
};

export const trackPurchase = (amount: number, orderId: string, overridePixelId?: string) => {
  // Re-init pixel with Advanced Matching data BEFORE firing Purchase (improves attribution)
  const pixelId = overridePixelId || getActivePixelId();
  if (pixelId && window.fbq) {
    try {
      const storedEmail = sessionStorage.getItem('meta_am_email');
      const storedPhone = sessionStorage.getItem('meta_am_phone');
      if (storedEmail || storedPhone) {
        const userData: Record<string, string> = {};
        if (storedEmail) userData.em = storedEmail;
        if (storedPhone) userData.ph = storedPhone.startsWith('91') ? storedPhone : `91${storedPhone}`;
        window.fbq('init', pixelId, userData);
        console.log('[MetaPixel] Re-initialized with Advanced Matching BEFORE Purchase');
      }
    } catch {}
  }

  // Use orderId as eventID for Meta deduplication & attribution
  const eventId = `purchase_${orderId}`;
  trackEvent('Purchase', {
    value: amount,
    currency: 'INR',
    order_id: orderId,
    content_type: 'product',
  }, overridePixelId, eventId);
};

/** Store user data for Meta Advanced Matching (call after form submission) */
export const setAdvancedMatchingData = (email: string, phone: string) => {
  try {
    sessionStorage.setItem('meta_am_email', email.trim().toLowerCase());
    sessionStorage.setItem('meta_am_phone', phone.replace(/\D/g, '').slice(-10));
    console.log('[MetaPixel] Advanced Matching data stored');
  } catch {}
};
