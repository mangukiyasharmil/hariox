import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStoredUtmParams } from "@/hooks/useUtmParams";

// Generate or retrieve visitor ID from localStorage
const getVisitorId = (): string => {
  const key = "analytics_visitor_id";
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(key, visitorId);
  }
  return visitorId;
};

// Generate session ID (new on each browser session)
const getSessionId = (): string => {
  const key = "analytics_session_id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

// Detect device type
const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
};

// Parse UTM parameters — prefer stored (sessionStorage) over current URL
const getUtmParams = () => {
  // First check sessionStorage (captured on landing)
  const stored = getStoredUtmParams();
  if (stored.utm_source || stored.utm_medium || stored.utm_campaign) {
    return stored;
  }
  // Fallback to current URL params
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || null,
    utm_medium: params.get("utm_medium") || null,
    utm_campaign: params.get("utm_campaign") || null,
  };
};

// Fetch user location from IP (cached in sessionStorage)
const getLocation = async (): Promise<{ city: string | null; country: string | null }> => {
  const cacheKey = "analytics_location";
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Continue to fetch
    }
  }

  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "force-cache" });
    if (res.ok) {
      const data = await res.json();
      const location = { city: data.city || null, country: data.country_name || null };
      sessionStorage.setItem(cacheKey, JSON.stringify(location));
      return location;
    }
  } catch (err) {
    console.log("Could not fetch location:", err);
  }
  return { city: null, country: null };
};

interface TrackEventOptions {
  eventType: string;
  companyId?: string | null;
  metadata?: Record<string, any>;
}

// Extract page path from URL (e.g., /capital, /pay/telecaller)
const getPagePath = (): string => {
  return window.location.pathname || "/";
};

export const trackAnalyticsEvent = async ({
  eventType,
  companyId,
  metadata = {},
}: TrackEventOptions) => {
  try {
    const utmParams = getUtmParams();
    const location = await getLocation();
    
    await supabase.from("analytics_events").insert({
      event_type: eventType,
      company_id: companyId || null,
      page_url: window.location.href,
      page_path: getPagePath(), // Added for Pages and Screens analytics
      referrer: document.referrer || null,
      utm_source: utmParams.utm_source,
      utm_medium: utmParams.utm_medium,
      utm_campaign: utmParams.utm_campaign,
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      user_agent: navigator.userAgent,
      device_type: getDeviceType(),
      city: location.city,
      country: location.country,
      metadata,
    });
  } catch (error) {
    console.error("Analytics tracking error:", error);
  }
};

// Hook for automatic page view tracking (per-page, deduplicates with global tracker)
export const useAnalyticsTracker = (companyId?: string | null) => {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    // Only track if global tracker hasn't already tracked this page path
    const currentPath = window.location.pathname;
    const trackedKey = `analytics_tracked_${currentPath}`;
    const alreadyTracked = sessionStorage.getItem(trackedKey);
    
    if (!alreadyTracked) {
      trackAnalyticsEvent({
        eventType: "pageview",
        companyId,
      });
      sessionStorage.setItem(trackedKey, "1");
    }
  }, [companyId]);

  // Return tracking function for custom events
  return {
    trackEvent: (eventType: string, metadata?: Record<string, any>) =>
      trackAnalyticsEvent({ eventType, companyId, metadata }),
  };
};

// Track lead submission
export const trackLeadEvent = (companyId: string | null, leadData: Record<string, any>) => {
  trackAnalyticsEvent({
    eventType: "lead",
    companyId,
    metadata: leadData,
  });
};

// Track payment
export const trackPaymentEvent = (companyId: string | null, paymentData: Record<string, any>) => {
  trackAnalyticsEvent({
    eventType: "payment",
    companyId,
    metadata: paymentData,
  });
};

export default useAnalyticsTracker;
